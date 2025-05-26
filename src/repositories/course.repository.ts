import { Op, FindOptions, Transaction } from 'sequelize';
import Course from '../models/course.model';
import User from '../models/user.model';
import Category from '../models/category.model';
import Section from '../models/section.model';
import Enrollment from '../models/enrollment.model';
import Review from '../models/review.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  instructor_id?: string;
  price_min?: number;
  price_max?: number;
  level?: string;
  status?: string;
}

export class CourseRepository extends BaseRepository<Course> {
  constructor() {
    super(Course);
  }

  /**
   * Find course with full details (instructor, categories, sections, etc.)
   */
  async findByIdWithDetails(id: string, options?: FindOptions): Promise<Course | null> {
    return await this.findById(id, {
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'bio', 'profile_thumbnail'],
        },
        {
          model: Category,
          as: 'categories',
          attributes: ['id', 'name', 'slug'],
          through: { attributes: [] },
        },
        {
          model: Section,
          as: 'sections',
          attributes: ['id', 'title', 'description', 'order_index'],
        },
      ],
      ...options,
    });
  }

  /**
   * Find courses by instructor ID
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, status } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { instructor_id };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (status) {
      if (status === 'published') {
        whereClause.is_published = true;
      } else if (status === 'draft') {
        whereClause.is_published = false;
      } else if (status === 'approved') {
        whereClause.is_approved = true;
      } else if (status === 'pending') {
        whereClause.is_approved = false;
      }
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'categories',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      courses: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find published and approved courses
   */
  async findPublishedCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      price_min,
      price_max,
      level,
      instructor_id,
    } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {
      is_published: true,
      is_approved: true,
    };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (price_min !== undefined || price_max !== undefined) {
      whereClause.price = {};
      if (price_min !== undefined) whereClause.price[Op.gte] = price_min;
      if (price_max !== undefined) whereClause.price[Op.lte] = price_max;
    }

    if (level) {
      whereClause.level = level;
    }

    if (instructor_id) {
      whereClause.instructor_id = instructor_id;
    }

    let includeOptions: any[] = [
      {
        model: User,
        as: 'instructor',
        attributes: ['id', 'name', 'profile_thumbnail'],
      },
      {
        model: Category,
        as: 'categories',
        attributes: ['id', 'name', 'slug'],
        through: { attributes: [] },
      },
    ];

    // Filter by category if specified
    if (category) {
      includeOptions[1].where = { slug: category };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      courses: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find courses with enrollment count and average rating
   */
  async findWithStats(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await this.findAndCountAll({
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'profile_thumbnail'],
        },
        {
          model: Enrollment,
          as: 'enrollments',
          attributes: [],
        },
        {
          model: Review,
          as: 'reviews',
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [
            Course.sequelize!.fn('COUNT', Course.sequelize!.col('enrollments.id')),
            'enrollment_count',
          ],
          [Course.sequelize!.fn('AVG', Course.sequelize!.col('reviews.rating')), 'average_rating'],
          [Course.sequelize!.fn('COUNT', Course.sequelize!.col('reviews.id')), 'review_count'],
        ],
      },
      group: ['Course.id', 'instructor.id'],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      courses: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Update course status (publish/unpublish)
   */
  async updateStatus(
    id: string,
    is_published: boolean,
    transaction?: Transaction
  ): Promise<Course | null> {
    return await this.updateById(id, { is_published }, { transaction });
  }

  /**
   * Update course approval status
   */
  async updateApprovalStatus(
    id: string,
    is_approved: boolean,
    transaction?: Transaction
  ): Promise<Course | null> {
    return await this.updateById(id, { is_approved }, { transaction });
  }

  /**
   * Get course statistics
   */
  async getCourseStats(): Promise<{
    totalCourses: number;
    publishedCourses: number;
    approvedCourses: number;
    recentCourses: number;
  }> {
    const [totalCourses, publishedCourses, approvedCourses, recentCourses] = await Promise.all([
      this.count(),
      this.count({ where: { is_published: true } }),
      this.count({ where: { is_approved: true } }),
      this.count({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      totalCourses,
      publishedCourses,
      approvedCourses,
      recentCourses,
    };
  }

  /**
   * Search courses with advanced filters
   */
  async searchCourses(
    searchTerm: string,
    filters: {
      categories?: string[];
      price_range?: { min?: number; max?: number };
      level?: string;
      rating?: number;
      instructor_id?: string;
    } = {},
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {
      is_published: true,
      is_approved: true,
    };

    // Text search
    if (searchTerm) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${searchTerm}%` } },
        { description: { [Op.iLike]: `%${searchTerm}%` } },
      ];
    }

    // Price range filter
    if (filters.price_range) {
      whereClause.price = {};
      if (filters.price_range.min !== undefined) {
        whereClause.price[Op.gte] = filters.price_range.min;
      }
      if (filters.price_range.max !== undefined) {
        whereClause.price[Op.lte] = filters.price_range.max;
      }
    }

    // Level filter
    if (filters.level) {
      whereClause.level = filters.level;
    }

    // Instructor filter
    if (filters.instructor_id) {
      whereClause.instructor_id = filters.instructor_id;
    }

    let includeOptions: any[] = [
      {
        model: User,
        as: 'instructor',
        attributes: ['id', 'name', 'profile_thumbnail'],
      },
      {
        model: Category,
        as: 'categories',
        attributes: ['id', 'name', 'slug'],
        through: { attributes: [] },
      },
    ];

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      includeOptions[1].where = { slug: { [Op.in]: filters.categories } };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      courses: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Get featured courses (highest rated or most enrolled)
   */
  async getFeaturedCourses(limit: number = 10): Promise<Course[]> {
    return await this.findAll({
      where: {
        is_published: true,
        is_approved: true,
        is_featured: true,
      },
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'profile_thumbnail'],
        },
        {
          model: Category,
          as: 'categories',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
      limit,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Check if user can access course (enrolled or instructor)
   */
  async canUserAccessCourse(course_id: string, user_id: string): Promise<boolean> {
    const course = await this.findOne({
      where: { id: course_id },
      include: [
        {
          model: Enrollment,
          as: 'enrollments',
          where: { user_id },
          required: false,
        },
      ],
    });

    if (!course) return false;

    // Check if user is instructor
    if (course.instructor_id === user_id) return true;

    // Check if user is enrolled
    const enrollments = course.get('enrollments') as Enrollment[];
    return enrollments && enrollments.length > 0;
  }
}

export default new CourseRepository();
