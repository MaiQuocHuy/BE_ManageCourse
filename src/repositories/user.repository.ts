import { Op, FindOptions } from 'sequelize';
import User from '../models/user.model';
import Course from '../models/course.model';
import UserRole from '../models/user-role.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, options?: FindOptions): Promise<User | null> {
    return await this.findOne({
      where: { email },
      ...options,
    });
  }

  /**
   * Find users with pagination and search
   */
  async findWithPagination(
    options: PaginationOptions = {}
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, role } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    let include: any[] = [
      {
        model: UserRole,
        as: 'roles',
        attributes: ['role'],
      },
    ];

    if (role) {
      include[0].where = { role };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      users: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find instructors with their course count
   */
  async findInstructorsWithCourseCount(
    options: PaginationOptions = {}
  ): Promise<{ instructors: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: UserRole,
          as: 'roles',
          where: { role: 'instructor' },
          attributes: ['role'],
        },
        {
          model: Course,
          as: 'courses',
          attributes: [],
        },
      ],
      group: ['User.id'],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      instructors: rows,
      total: count,
      page,
      limit,
    };
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
    }
  ): Promise<User | null> {
    return await this.updateById(id, profileData);
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<User | null> {
    return await this.updateById(id, { password: hashedPassword });
  }

  /**
   * Check if email exists (excluding specific user ID)
   */
  async emailExistsExcludingUser(email: string, excludeUserId: string): Promise<boolean> {
    return await this.exists({
      email,
      id: { [Op.ne]: excludeUserId },
    });
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
    const [totalUsers, recentUsers] = await Promise.all([
      this.count(),
      this.count({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    // Count instructors and students through UserRole model
    const [totalInstructors, totalStudents] = await Promise.all([
      UserRole.count({ where: { role: 'instructor' } }),
      UserRole.count({ where: { role: 'student' } }),
    ]);

    return {
      totalUsers,
      totalInstructors,
      totalStudents,
      recentUsers,
    };
  }
}

export default new UserRepository();
