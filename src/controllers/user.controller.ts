import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/user-role.model';
import { ApiError } from '../utils/api-error';
import { uploadToCloudinary } from '../utils/upload';
import userService from '../services/user.service';
import { DeviceInfo } from '../models/refresh-token.model';

class UserController {
  // Register a new user
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;
      const deviceInfo: DeviceInfo = (req as any).deviceInfo;

      const user = await userService.createUser({
        name,
        email,
        password,
      });

      // Generate tokens for immediate login
      const { accessToken, refreshToken } = await userService.login(email, password, deviceInfo);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const deviceInfo: DeviceInfo = (req as any).deviceInfo;

      const { accessToken, refreshToken, user } = await userService.login(
        email,
        password,
        deviceInfo
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            profile_thumbnail: user.profile_thumbnail,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout user from current device (enhanced with JTI)
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = req.user!.id;
      const jti = req.user!.jti; // Get JTI from authenticated user

      if (refreshToken) {
        // If refresh token provided, logout that specific session
        await userService.logout(refreshToken, jti);
        res.status(200).json({
          success: true,
          message: 'Logged out from current device successfully',
        });
      } else if (jti) {
        // If JTI available, logout by JTI (access token based logout)
        await userService.logoutDeviceByJti(userId, jti);
        res.status(200).json({
          success: true,
          message: 'Access token revoked successfully',
        });
      } else {
        // Fallback: logout all devices for security
        await userService.logoutAllDevices(userId);
        res.status(200).json({
          success: true,
          message: 'Logged out from all devices successfully (token version updated)',
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Logout user from all devices (enhanced with JTI cleanup)
  async logoutAllDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      await userService.logoutAllDevices(userId);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully - all tokens invalidated',
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout from specific device by JTI
  async logoutDeviceByJti(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { jti } = req.params;

      await userService.logoutDeviceByJti(userId, jti);

      res.status(200).json({
        success: true,
        message: 'Device session terminated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout from specific device by refresh token ID
  async logoutDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tokenId } = req.params;

      await userService.logoutDevice(userId, parseInt(tokenId));

      res.status(200).json({
        success: true,
        message: 'Device logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get active sessions (enhanced with JTI data)
  async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const currentJti = req.user!.jti; // Current session JTI

      const sessions = await userService.getActiveSessions(userId, currentJti);

      res.status(200).json({
        success: true,
        data: sessions,
        meta: {
          total: sessions.length,
          current_jti: currentJti,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get token statistics (admin only)
  async getTokenStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getTokenStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Refresh access token (enhanced with JTI)
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const deviceInfo: DeviceInfo = (req as any).deviceInfo;

      if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
      }

      const { accessToken, user, jti } = await userService.refreshAccessToken(
        refreshToken,
        deviceInfo
      );

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          jti, // Include JTI in response for client tracking
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current user profile
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Not authenticated');
      }

      const user = await userService.getUserById(String(userId));
      const roles = await userService.getUserRoles(String(userId));

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          profile_thumbnail: user.profile_thumbnail,
          is_active: user.is_active,
          roles: roles.map(role => role.role),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user by ID
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;

      const user = await userService.getUserById(userId);
      const roles = await userService.getUserRoles(userId);

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          profile_thumbnail: user.profile_thumbnail,
          is_active: user.is_active,
          roles: roles.map(role => role.role),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { name, bio } = req.body;

      // Check if user is authorized (admin or the user themselves)
      if (req.user?.id !== userId && !req.user?.roles.includes(Role.ADMIN)) {
        throw new ApiError(403, 'Not authorized to update this user');
      }

      let profile_thumbnail = undefined;
      console.log('Name, bio:', name, bio);
      console.log('Files', req.file);
      if (req.file) {
        profile_thumbnail = await uploadToCloudinary(req.file);
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (bio !== undefined) updateData.bio = bio;
      if (profile_thumbnail) updateData.profile_thumbnail = profile_thumbnail;

      const updatedUser = await userService.updateUser(userId, updateData);

      res.status(200).json({
        success: true,
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          bio: updatedUser.bio,
          profile_thumbnail: updatedUser.profile_thumbnail,
          is_active: updatedUser.is_active,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Change password
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { currentPassword, newPassword } = req.body;

      // Check if user is authorized (only the user themselves)
      if (req.user?.id !== userId) {
        throw new ApiError(403, "Not authorized to change this user's password");
      }

      await userService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Add role to user
  async addUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (!Object.values(Role).includes(role)) {
        throw new ApiError(400, 'Invalid role');
      }

      await userService.addUserRole(userId, role);

      res.status(200).json({
        success: true,
        message: `Role ${role} added to user successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove role from user
  async removeUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (!Object.values(Role).includes(role)) {
        throw new ApiError(400, 'Invalid role');
      }

      await userService.removeUserRole(userId, role);

      res.status(200).json({
        success: true,
        message: `Role ${role} removed from user successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all users (with pagination and filtering)
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const role = req.query.role as Role | undefined;
      const search = req.query.search as string | undefined;

      const result = await userService.getAllUsers({
        page,
        limit,
        role,
        search,
      });

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete user
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;

      // Check if user is authorized (admin or the user themselves)
      if (req.user?.id !== userId && !req.user?.roles.includes(Role.ADMIN)) {
        throw new ApiError(403, 'Not authorized to delete this user');
      }

      await userService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
