import { Transaction } from 'sequelize';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { userRepository } from '../repositories';
import User from '../models/user.model';
import UserRole, { Role } from '../models/user-role.model';
import RefreshToken, { DeviceInfo } from '../models/refresh-token.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';
import redisTokenService from './redis-token.service';

interface UserCreateData {
  name: string;
  email: string;
  password: string;
  bio?: string;
  profile_thumbnail?: string;
}

interface UserUpdateData {
  name?: string;
  bio?: string;
  profile_thumbnail?: string;
  is_active?: boolean;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  role?: Role;
  search?: string;
}

// Enhanced interfaces for token management
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
  deviceInfo?: DeviceInfo;
  jti: string; // Include JTI in response for session tracking
}

interface RefreshResult {
  accessToken: string;
  user: User;
  jti: string; // Include new JTI
}

interface ActiveSession {
  id: number;
  jti: string;
  device_name: string;
  ip_address?: string;
  last_used_at?: Date;
  created_at: Date;
  is_current?: boolean;
  token_version: number;
}

class UserService {
  /**
   * Create a new user
   */
  async createUser(userData: UserCreateData): Promise<User> {
    let transaction: Transaction | null = null;

    try {
      // Check if user with email already exists using repository
      const existingUser = await userRepository.findByEmail(userData.email);
      if (existingUser) {
        throw new ApiError(400, 'Email already in use');
      }

      // Start transaction
      transaction = await sequelize.transaction();

      // Create user using repository
      const user = await userRepository.create(userData, { transaction });

      // Assign default role (student)
      await UserRole.create(
        {
          user_id: user.id,
          role: Role.STUDENT,
        },
        { transaction }
      );

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return user;
    } catch (error) {
      // Rollback transaction on error
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }

      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Error creating user');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id, {
      include: [{ model: UserRole, as: 'roles' }],
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User> {
    const user = await userRepository.findByEmail(email, {
      include: [{ model: UserRole, as: 'roles' }],
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(id: string, updateData: UserUpdateData): Promise<User> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const updatedUser = await userRepository.updateById(id, updateData);

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return updatedUser;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    id: string,
    profileData: {
      name?: string;
      bio?: string;
      profile_thumbnail?: string;
      social_links?: any;
    }
  ): Promise<User> {
    const updatedUser = await userRepository.updateProfile(id, profileData);

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return updatedUser;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    const deleted = await userRepository.deleteById(id);

    if (!deleted) {
      throw new ApiError(404, 'User not found');
    }
  }

  /**
   * Get all users with pagination and filtering
   */
  async getAllUsers(
    options: PaginationOptions = {}
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, role, search } = options;

    // Use repository method for pagination and search
    return await userRepository.findWithPagination({
      page,
      limit,
      search,
      role,
    });
  }

  /**
   * Get instructors with course count
   */
  async getInstructors(
    options: PaginationOptions = {}
  ): Promise<{ instructors: any[]; total: number; page: number; limit: number }> {
    return await userRepository.findInstructorsWithCourseCount(options);
  }

  /**
   * Change password
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isPasswordValid = await user.verifyPassword(oldPassword);
    if (!isPasswordValid) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    // Update password using repository
    await userRepository.updatePassword(id, newPassword);

    // Revoke all refresh tokens for security
    await this.revokeAllUserRefreshTokens(id);
  }

  /**
   * Add role to user
   */
  async addUserRole(userId: string, role: Role): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const existingRole = await UserRole.findOne({
      where: { user_id: userId, role },
    });

    if (existingRole) {
      throw new ApiError(400, 'User already has this role');
    }

    await UserRole.create({ user_id: userId, role });
  }

  /**
   * Remove role from user
   */
  async removeUserRole(userId: string, role: Role): Promise<void> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const userRoles = await UserRole.findAll({
      where: { user_id: userId },
    });

    if (userRoles.length <= 1) {
      throw new ApiError(400, 'Cannot remove the only role from a user');
    }

    await UserRole.destroy({
      where: { user_id: userId, role },
    });
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return UserRole.findAll({
      where: { user_id: userId },
    });
  }

  /**
   * Login user with enhanced device tracking and JTI
   */
  async login(email: string, password: string, deviceInfo?: DeviceInfo): Promise<LoginResult> {
    const user = await this.getUserByEmail(email);

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Generate JTI for access token
    const jti = redisTokenService.generateJti();

    // Generate tokens
    const accessToken = await this.generateAccessToken(user, jti);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      user.token_version,
      deviceInfo,
      jti
    );

    // Store JTI in Redis with TTL matching access token
    await redisTokenService.storeJti(
      jti,
      user.id,
      user.token_version,
      deviceInfo,
      15 * 60 // 15 minutes TTL
    );

    return { accessToken, refreshToken, user, deviceInfo, jti };
  }

  /**
   * Logout from current device only (enhanced with JTI)
   */
  async logout(token: string, jti?: string): Promise<void> {
    // Revoke JTI if provided
    if (jti) {
      await redisTokenService.revokeJti(jti);
    }

    // Revoke refresh token
    await this.revokeRefreshToken(token);

    // Also revoke in Redis if it's stored there
    const refreshTokenRecord = await RefreshToken.findOne({
      where: { token },
    });

    if (refreshTokenRecord) {
      await redisTokenService.revokeRefreshToken(refreshTokenRecord.id.toString());
    }
  }

  /**
   * Logout from all devices (enhanced with JTI cleanup)
   */
  async logoutAllDevices(userId: string): Promise<void> {
    const user = await this.getUserById(userId);

    // Revoke all JTIs in Redis for this user
    await redisTokenService.revokeAllUserJtis(userId);

    // Increment user's token version to invalidate all existing tokens
    await user.incrementTokenVersion();

    // Revoke all refresh tokens for this user in database
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );
  }

  /**
   * Logout from specific device by JTI
   */
  async logoutDeviceByJti(userId: string, jti: string): Promise<void> {
    // Verify JTI belongs to user
    const jtiData = await redisTokenService.verifyJti(jti);
    if (!jtiData || jtiData.userId !== userId) {
      throw new ApiError(404, 'Session not found');
    }

    // Revoke JTI
    await redisTokenService.revokeJti(jti, userId);
  }

  /**
   * Logout from specific device by refresh token ID
   */
  async logoutDevice(userId: string, tokenId: number): Promise<void> {
    const refreshToken = await RefreshToken.findOne({
      where: {
        id: tokenId,
        user_id: userId,
        is_revoked: false,
      },
    });

    if (!refreshToken) {
      throw new ApiError(404, 'Session not found');
    }

    // Revoke refresh token
    await refreshToken.update({ is_revoked: true });

    // Revoke in Redis
    await redisTokenService.revokeRefreshToken(tokenId.toString());
  }

  /**
   * Get active sessions for user (enhanced with JTI data)
   */
  async getActiveSessions(userId: string, currentJti?: string): Promise<ActiveSession[]> {
    // Get sessions from Redis (JTI-based)
    const redisSessions = await redisTokenService.getUserActiveSessions(userId);

    // Get sessions from database (refresh token-based)
    const dbSessions = await RefreshToken.findAll({
      where: {
        user_id: userId,
        is_revoked: false,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [
        ['last_used_at', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    // Combine and format sessions
    const sessions: ActiveSession[] = [];

    // Add Redis sessions (active access tokens)
    redisSessions.forEach(session => {
      sessions.push({
        id: 0, // JTI-based sessions don't have DB ID
        jti: session.jti,
        device_name: session.deviceInfo?.device_name || 'Unknown Device',
        ip_address: session.deviceInfo?.ip_address,
        last_used_at: undefined, // Access tokens don't track last used
        created_at: new Date(session.createdAt),
        is_current: currentJti ? session.jti === currentJti : false,
        token_version: session.tokenVersion,
      });
    });

    // Add database sessions (refresh tokens)
    dbSessions.forEach(token => {
      sessions.push({
        id: token.id,
        jti: '', // Refresh tokens don't have JTI
        device_name: token.getDeviceDisplayName(),
        ip_address: token.ip_address,
        last_used_at: token.last_used_at,
        created_at: token.created_at,
        is_current: false,
        token_version: token.version,
      });
    });

    return sessions;
  }

  /**
   * Refresh access token with enhanced validation and JTI
   */
  async refreshAccessToken(token: string, deviceInfo?: DeviceInfo): Promise<RefreshResult> {
    const refreshTokenRecord = await RefreshToken.findOne({
      where: { token, is_revoked: false },
      include: [{ model: User, attributes: { exclude: ['password'] } }],
    });

    if (!refreshTokenRecord) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Check Redis for refresh token status
    const redisStatus = await redisTokenService.isRefreshTokenRevoked(
      refreshTokenRecord.id.toString()
    );
    if (redisStatus === true) {
      throw new ApiError(401, 'Refresh token has been revoked');
    }

    // Get the associated user
    const user = await this.getUserById(refreshTokenRecord.user_id);

    // Check if token is valid (including version check)
    if (!refreshTokenRecord.isValid(user.token_version)) {
      await refreshTokenRecord.update({ is_revoked: true });
      await redisTokenService.revokeRefreshToken(refreshTokenRecord.id.toString());
      throw new ApiError(401, 'Token version mismatch - please login again');
    }

    // Update last used timestamp
    await refreshTokenRecord.updateLastUsed();

    // Update device info if provided
    if (deviceInfo) {
      const updateData: any = {};
      if (deviceInfo.ip_address) updateData.ip_address = deviceInfo.ip_address;
      if (deviceInfo.user_agent) updateData.user_agent = deviceInfo.user_agent;
      if (deviceInfo.device_name) updateData.device_name = deviceInfo.device_name;

      if (Object.keys(updateData).length > 0) {
        await refreshTokenRecord.update(updateData);
      }
    }

    // Generate new JTI for new access token
    const jti = redisTokenService.generateJti();

    // Generate new access token with new JTI
    const accessToken = await this.generateAccessToken(user, jti);

    // Store new JTI in Redis
    await redisTokenService.storeJti(
      jti,
      user.id,
      user.token_version,
      deviceInfo || {
        device_name: refreshTokenRecord.device_name,
        ip_address: refreshTokenRecord.ip_address,
        user_agent: refreshTokenRecord.user_agent,
      },
      15 * 60 // 15 minutes TTL
    );

    return { accessToken, user, jti };
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    totalInstructors: number;
    totalStudents: number;
    recentUsers: number;
  }> {
    return await userRepository.getUserStats();
  }

  /**
   * Check if email exists (excluding specific user)
   */
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    if (excludeUserId) {
      return !(await userRepository.emailExistsExcludingUser(email, excludeUserId));
    } else {
      const user = await userRepository.findByEmail(email);
      return !user;
    }
  }

  // ====================
  // Private Token Methods (Enhanced with JTI)
  // ====================

  /**
   * Generate access token with JTI and shorter expiration
   */
  private async generateAccessToken(user: User, jti: string): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
      version: user.token_version, // Include version in JWT for validation
      jti, // Include JTI in JWT payload
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '15m', // Shorter access token lifetime (15 minutes)
    });
  }

  /**
   * Generate refresh token with device tracking, versioning, and JTI reference
   */
  private async generateRefreshToken(
    userId: string,
    version: number,
    deviceInfo?: DeviceInfo,
    relatedJti?: string
  ): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    const refreshTokenRecord = await RefreshToken.create({
      user_id: userId,
      token,
      expires_at: expiresAt,
      is_revoked: false,
      version,
      device_name: deviceInfo?.device_name,
      ip_address: deviceInfo?.ip_address,
      user_agent: deviceInfo?.user_agent,
      last_used_at: new Date(),
    });

    // Store refresh token status in Redis as well
    await redisTokenService.storeRefreshTokenStatus(
      refreshTokenRecord.id.toString(),
      userId,
      false,
      30 * 24 * 60 * 60 // 30 days TTL
    );

    return token;
  }

  /**
   * Revoke refresh token (enhanced with Redis)
   */
  async revokeRefreshToken(token: string): Promise<void> {
    const refreshToken = await RefreshToken.findOne({
      where: { token },
    });

    if (refreshToken) {
      // Revoke in database
      await refreshToken.update({ is_revoked: true });

      // Revoke in Redis
      await redisTokenService.revokeRefreshToken(refreshToken.id.toString());
    }
  }

  /**
   * Revoke all user refresh tokens (enhanced with Redis)
   */
  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    // Get all user's refresh tokens
    const refreshTokens = await RefreshToken.findAll({
      where: { user_id: userId, is_revoked: false },
    });

    // Revoke in database
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );

    // Revoke in Redis
    for (const token of refreshTokens) {
      await redisTokenService.revokeRefreshToken(token.id.toString());
    }
  }

  /**
   * Remove expired and revoked refresh tokens (enhanced cleanup)
   */
  async removeExpiredRefreshTokens(): Promise<void> {
    await RefreshToken.destroy({
      where: {
        [Op.or]: [{ expires_at: { [Op.lt]: new Date() } }, { is_revoked: true }],
      },
    });

    // Also cleanup Redis
    await redisTokenService.cleanupExpiredTokens();
  }

  /**
   * Remove old unused sessions (enhanced cleanup)
   */
  async removeOldUnusedSessions(daysOld: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Remove tokens that were last used before cutoff date or created long ago
    await RefreshToken.destroy({
      where: {
        [Op.or]: [
          { last_used_at: { [Op.lt]: cutoffDate } },
          { created_at: { [Op.lt]: cutoffDate } },
        ],
      },
    });
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    redis: {
      totalJtis: number;
      totalRefreshTokens: number;
      memoryUsage: string;
    };
    database: {
      totalRefreshTokens: number;
      activeRefreshTokens: number;
      revokedRefreshTokens: number;
    };
  }> {
    const redisStats = await redisTokenService.getStats();

    const totalTokens = await RefreshToken.count();
    const activeTokens = await RefreshToken.count({
      where: { is_revoked: false, expires_at: { [Op.gt]: new Date() } },
    });
    const revokedTokens = await RefreshToken.count({
      where: { is_revoked: true },
    });

    return {
      redis: redisStats,
      database: {
        totalRefreshTokens: totalTokens,
        activeRefreshTokens: activeTokens,
        revokedRefreshTokens: revokedTokens,
      },
    };
  }
}

export default new UserService();
