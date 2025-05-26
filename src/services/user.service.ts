import { Transaction } from 'sequelize';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { userRepository } from '../repositories';
import User from '../models/user.model';
import UserRole, { Role } from '../models/user-role.model';
import RefreshToken from '../models/refresh-token.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

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
   * Login user
   */
  async login(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const user = await this.getUserByEmail(email);

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken, user };
  }

  /**
   * Logout user
   */
  async logout(token: string): Promise<void> {
    await this.revokeRefreshToken(token);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(token: string): Promise<{ accessToken: string; user: User }> {
    const refreshTokenRecord = await RefreshToken.findOne({
      where: { token, is_revoked: false },
      include: [{ model: User, attributes: { exclude: ['password'] } }],
    });

    if (!refreshTokenRecord) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (new Date() > refreshTokenRecord.expires_at) {
      await refreshTokenRecord.update({ is_revoked: true });
      throw new ApiError(401, 'Refresh token expired');
    }

    const user = await this.getUserById(refreshTokenRecord.user_id);
    const accessToken = this.generateAccessToken(user);

    return { accessToken, user };
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
  // Private Token Methods
  // ====================

  /**
   * Generate access token
   */
  private generateAccessToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '1h',
    });
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await RefreshToken.create({
      user_id: userId,
      token,
      expires_at: expiresAt,
      is_revoked: false,
    });

    return token;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    const refreshToken = await RefreshToken.findOne({
      where: { token },
    });

    if (refreshToken) {
      await refreshToken.update({ is_revoked: true });
    }
  }

  /**
   * Revoke all user refresh tokens
   */
  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );
  }

  /**
   * Remove expired refresh tokens
   */
  async removeExpiredRefreshTokens(): Promise<void> {
    await RefreshToken.destroy({
      where: {
        [Op.or]: [{ expires_at: { [Op.lt]: new Date() } }, { is_revoked: true }],
      },
    });
  }
}

export default new UserService();
