import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error";
import userService from "../services/user.service";
import { Role } from "../models/user-role.model";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: Role[];
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Body", req.body);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new ApiError(401, "Authentication token required");
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as { id: string; email: string };

      // Get user roles
      const roles = await userService.getUserRoles(decoded.id);

      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        roles: roles.map((role) => role.role),
      };

      next();
    } catch (error) {
      throw new ApiError(401, "Invalid or expired token");
    }
  } catch (error) {
    next(error);
  }
};
