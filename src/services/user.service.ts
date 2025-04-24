import User from "../models/user.model";
import UserRole, { Role } from "../models/user-role.model";
import RefreshToken from "../models/refresh-token.model";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../utils/api-error";

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
  // Create a new user
  async createUser(userData: UserCreateData): Promise<User> {
    try {
      // Check if user with email already exists
      const existingUser = await User.findOne({
        where: { email: userData.email },
      });
      if (existingUser) {
        throw new ApiError(400, "Email already in use");
      }

      // Create user
      const user = await User.create(userData);

      // Assign default role (student)
      await UserRole.create({
        user_id: user.id,
        role: Role.STUDENT,
      });

      return user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Error creating user");
    }
  }

  // Get user by ID
  async getUserById(id: string): Promise<User> {
    const user = await User.findByPk(id, {
      include: [{ model: UserRole, as: "roles" }],
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User> {
    const user = await User.findOne({
      where: { email },
      include: [{ model: UserRole, as: "roles" }],
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  // Update user
  async updateUser(id: string, updateData: UserUpdateData): Promise<User> {
    const user = await User.findByPk(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await user.update(updateData);

    return user;
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    const user = await User.findByPk(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await user.destroy();
  }

  // Get all users with pagination and filtering
  async getAllUsers(
    options: PaginationOptions = {}
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, role, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};
    if (search) {
      whereClause = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    let includeClause: any = [{ model: UserRole, as: "roles" }];
    if (role) {
      includeClause = [
        {
          model: UserRole,
          as: "roles",
          where: { role },
        },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit,
      offset,
      distinct: true,
      attributes: { exclude: ["password"] },
    });

    return {
      users: rows,
      total: count,
      page,
      limit,
    };
  }

  // Change password
  async changePassword(
    id: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findByPk(id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.verifyPassword(oldPassword);
    if (!isPasswordValid) {
      throw new ApiError(400, "Current password is incorrect");
    }

    await user.update({ password: newPassword });

    // Revoke all refresh tokens for security
    await this.revokeAllUserRefreshTokens(id);
  }

  // Add role to user
  async addUserRole(userId: string, role: Role): Promise<void> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const existingRole = await UserRole.findOne({
      where: { user_id: userId, role },
    });

    if (existingRole) {
      throw new ApiError(400, "User already has this role");
    }

    await UserRole.create({ user_id: userId, role });
  }

  // Remove role from user
  async removeUserRole(userId: number, role: Role): Promise<void> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const userRoles = await UserRole.findAll({
      where: { user_id: userId },
    });

    if (userRoles.length <= 1) {
      throw new ApiError(400, "Cannot remove the only role from a user");
    }

    await UserRole.destroy({
      where: { user_id: userId, role },
    });
  }

  // Get user roles
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return UserRole.findAll({
      where: { user_id: userId },
    });
  }

  // Authentication methods
  async login(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const user = await this.getUserByEmail(email);

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken, user };
  }

  async logout(token: string): Promise<void> {
    await this.revokeRefreshToken(token);
  }

  async refreshAccessToken(
    token: string
  ): Promise<{ accessToken: string; user: User }> {
    const refreshTokenRecord = await RefreshToken.findOne({
      where: { token, is_revoked: false },
      include: [{ model: User, attributes: { exclude: ["password"] } }],
    });

    if (!refreshTokenRecord) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (new Date() > refreshTokenRecord.expires_at) {
      await refreshTokenRecord.update({ is_revoked: true });
      throw new ApiError(401, "Refresh token expired");
    }

    const user = await this.getUserById(refreshTokenRecord.user_id);
    const accessToken = this.generateAccessToken(user);

    return { accessToken, user };
  }

  // Token management
  private generateAccessToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "1h",
    });
  }

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

  async revokeRefreshToken(token: string): Promise<void> {
    const refreshToken = await RefreshToken.findOne({
      where: { token },
    });

    if (refreshToken) {
      await refreshToken.update({ is_revoked: true });
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );
  }

  async removeExpiredRefreshTokens(): Promise<void> {
    await RefreshToken.destroy({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lt]: new Date() } },
          { is_revoked: true },
        ],
      },
    });
  }
}

export default new UserService();
