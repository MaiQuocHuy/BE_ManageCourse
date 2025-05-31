import { Op, FindOptions } from 'sequelize';
import Enrollment from '../models/enrollment.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class EnrollmentRepository extends BaseRepository<Enrollment> {
  constructor() {
    super(Enrollment);
  }

  /**
   * Find enrollment by user and course
   */
  async findByUserAndCourse(
    user_id: string,
    course_id: string,
    options?: FindOptions
  ): Promise<Enrollment | null> {
    return await this.findOne({
      where: { user_id, course_id },
      ...options,
    });
  }

  /**
   * Find enrollment by ID with details
   */
  async findByIdWithDetails(id: string): Promise<Enrollment | null> {
    return await this.findById(id, {
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'name', 'email', 'profile_thumbnail'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail', 'price'],
        },
      ],
    });
  }

  /**
   * Find enrollments by user ID with course details
   */
  async findByUserId(
    user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ enrollments: Enrollment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { user_id };

    let courseWhere: any = {};
    if (search) {
      courseWhere.title = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          where: Object.keys(courseWhere).length > 0 ? courseWhere : undefined,
          attributes: ['id', 'title', 'description', 'thumbnail', 'price', 'instructor_id'],
          include: [
            {
              model: User,
              as: 'instructor',
              attributes: ['id', 'name', 'profile_thumbnail'],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      enrollments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find enrollments by course ID with user details
   */
  async findByCourseId(
    course_id: string,
    options: PaginationOptions = {}
  ): Promise<{ enrollments: Enrollment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { course_id };

    let userWhere: any = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'student',
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          attributes: ['id', 'name', 'email', 'profile_thumbnail'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      enrollments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find enrollments by instructor ID
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ enrollments: Enrollment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    let userWhere: any = {};
    let courseWhere: any = { instructor_id };

    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'student',
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          attributes: ['id', 'name', 'email', 'profile_thumbnail'],
        },
        {
          model: Course,
          as: 'course',
          where: courseWhere,
          attributes: ['id', 'title', 'thumbnail'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      enrollments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Check if user is enrolled in course
   */
  async isUserEnrolled(user_id: string, course_id: string): Promise<boolean> {
    return await this.exists({ user_id, course_id });
  }

  /**
   * Get enrollment count for a course
   */
  async getEnrollmentCount(course_id: string): Promise<number> {
    return await this.count({ where: { course_id } });
  }

  /**
   * Get enrollment statistics
   */
  async getEnrollmentStats(): Promise<{
    totalEnrollments: number;
    recentEnrollments: number;
  }> {
    const [totalEnrollments, recentEnrollments] = await Promise.all([
      this.count(),
      this.count({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      totalEnrollments,
      recentEnrollments,
    };
  }

  /**
   * Get popular courses by enrollment count
   */
  async getPopularCourses(limit: number = 10): Promise<any[]> {
    const enrollments = await Enrollment.findAll({
      attributes: [
        'course_id',
        [
          Enrollment.sequelize!.fn('COUNT', Enrollment.sequelize!.col('Enrollment.id')),
          'enrollment_count',
        ],
      ],
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail', 'price'],
        },
      ],
      group: ['course_id', 'course.id', 'course.title', 'course.thumbnail', 'course.price'],
      order: [[Enrollment.sequelize!.literal('enrollment_count'), 'DESC']],
      limit,
      raw: true,
      nest: true,
    });

    return enrollments;
  }

  /**
   * Get student count by instructor
   */
  async getStudentCountByInstructor(instructor_id: string): Promise<number> {
    const result = await Enrollment.count({
      distinct: true,
      col: 'user_id',
      include: [
        {
          model: Course,
          as: 'course',
          where: { instructor_id },
          attributes: [],
        },
      ],
    });

    return result;
  }

  /**
   * Get most popular courses with pagination
   */
  async getMostPopularCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const courses = await this.getPopularCourses(limit + offset);
    const paginatedCourses = courses.slice(offset, offset + limit);

    return {
      courses: paginatedCourses,
      total: courses.length,
      page,
      limit,
    };
  }
}

export default new EnrollmentRepository();
