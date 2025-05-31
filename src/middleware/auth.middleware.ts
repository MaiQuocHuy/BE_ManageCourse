import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error";
import userService from "../services/user.service";
import redisTokenService from '../services/redis-token.service';
import { Role } from "../models/user-role.model";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: Role[];
        tokenVersion?: number;
        jti?: string; // Add JTI to user context
      };
    }
  }
}

// Enhanced JWT payload interface
interface JWTPayload {
  id: string;
  email: string;
  version?: number;
  jti?: string; // JWT ID for token tracking
  iat?: number;
  exp?: number;
}

/**
 * Enhanced Authentication Middleware with JTI Cross-Validation
 * Implements 5 layers of validation:
 * 1. JWT format validation
 * 2. JWT signature verification
 * 3. JTI existence check in Redis
 * 4. User existence verification
 * 5. Token version matching
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new ApiError(401, 'Authentication token required');
    }

    try {
      // 🔐 Layer 1 & 2: Decode and verify JWT signature
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;

      // 🔐 Layer 3: JTI Cross-Validation with Redis
      if (decoded.jti) {
        const jtiData = await redisTokenService.verifyJti(decoded.jti);

        if (!jtiData) {
          throw new ApiError(401, 'Token has been revoked or expired');
        }

        // Verify JTI belongs to the correct user
        if (jtiData.userId !== decoded.id) {
          throw new ApiError(401, 'Token ownership mismatch');
        }

        // Cross-validate token version from JTI data
        if (decoded.version && jtiData.tokenVersion !== decoded.version) {
          throw new ApiError(401, 'Token version mismatch from JTI');
        }
      } else {
        // If no JTI in token, this might be an old token format
        console.warn(`Token without JTI detected for user: ${decoded.id}`);
      }

      // 🔐 Layer 4: User existence verification
      const user = await userService.getUserById(decoded.id);

      // 🔐 Layer 5: Token version cross-validation with database
      if (decoded.version && decoded.version !== user.token_version) {
        // Cleanup Redis JTI if it exists
        if (decoded.jti) {
          await redisTokenService.revokeJti(decoded.jti, decoded.id);
        }
        throw new ApiError(401, 'Token version mismatch - please login again');
      }

      // Get user roles
      const roles = await userService.getUserRoles(decoded.id);

      // ✅ All validations passed - attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        roles: roles.map(role => role.role),
        tokenVersion: user.token_version,
        jti: decoded.jti, // Include JTI for logout tracking
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Cleanup expired JTI from Redis if it exists
        try {
          const decoded = jwt.decode(token) as JWTPayload;
          if (decoded?.jti) {
            await redisTokenService.revokeJti(decoded.jti, decoded.id);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up expired JTI:', cleanupError);
        }
        throw new ApiError(401, 'Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid access token format');
      } else if (error instanceof ApiError) {
        throw error;
      } else {
        console.error('Unexpected authentication error:', error);
        throw new ApiError(401, 'Token validation failed');
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to extract device information from request
 * Enhanced with more detailed device detection
 */
export const extractDeviceInfo = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent') || '';
  const forwardedFor = req.get('X-Forwarded-For');
  const realIp = req.get('X-Real-IP');

  // Get the most accurate IP address
  let ipAddress = req.ip || req.connection.remoteAddress;
  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ipAddress = realIp;
  }

  // Enhanced device detection
  let deviceName = req.get('X-Device-Name'); // Custom header
  if (!deviceName && userAgent) {
    // Auto-detect device from user agent
    if (userAgent.includes('Mobile')) {
      if (userAgent.includes('iPhone')) deviceName = 'iPhone';
      else if (userAgent.includes('Android')) deviceName = 'Android Device';
      else deviceName = 'Mobile Device';
    } else if (userAgent.includes('Chrome')) {
      deviceName = 'Chrome Browser';
    } else if (userAgent.includes('Firefox')) {
      deviceName = 'Firefox Browser';
    } else if (userAgent.includes('Safari')) {
      deviceName = 'Safari Browser';
    } else if (userAgent.includes('Edge')) {
      deviceName = 'Edge Browser';
    } else {
      deviceName = 'Unknown Device';
    }
  }

  const deviceInfo = {
    ip_address: ipAddress,
    user_agent: userAgent,
    device_name: deviceName || 'Unknown Device',
  };

  // Attach device info to request for use in login/refresh
  (req as any).deviceInfo = deviceInfo;
  next();
};

/**
 * Middleware for soft authentication (optional authentication)
 * Does not throw errors if token is missing, but validates if present
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Token provided, validate it using the same logic as authenticate
    await authenticate(req, res, next);
  } catch (error) {
    // Log the error but don't block the request
    console.warn('Optional authentication failed:', error);
    next();
  }
};

/**
 * Middleware to verify token freshness (for sensitive operations)
 * Requires token to be issued within the last N minutes
 */
export const requireFreshToken = (maxAgeMinutes: number = 5) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.jti) {
        throw new ApiError(401, 'Fresh token required for this operation');
      }

      const jtiData = await redisTokenService.verifyJti(req.user.jti);
      if (!jtiData) {
        throw new ApiError(401, 'Token validation failed');
      }

      const tokenAge = Date.now() - new Date(jtiData.createdAt).getTime();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;

      if (tokenAge > maxAgeMs) {
        throw new ApiError(
          401,
          `Token too old. Please re-authenticate within ${maxAgeMinutes} minutes.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
