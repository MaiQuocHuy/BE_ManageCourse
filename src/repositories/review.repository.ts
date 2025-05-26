import { Op, Sequelize, FindOptions, Transaction } from 'sequelize';
import { QueryTypes } from 'sequelize';
import Review from '../models/review.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';
import sequelize from '../config/database';

interface PaginationOptions {
  page?: number;
  limit?: number;
  rating?: number;
  search?: string;
}

interface AverageRatingResult {
  averageRating: number;
}

interface RatingCountResult {
  rating: number;
  count: number;
}

interface HighestRatedCourseResult {
  id: string;
  title: string;
  thumbnail: string;
  price: number;
  instructor_id: string;
  average_rating: number;
  review_count: number;
}

export class ReviewRepository extends BaseRepository<Review> {
  constructor() {
    super(Review);
  }

  /**
   * Find review by user and course
   */
  async findByUserAndCourse(
    user_id: string,
    course_id: string,
    options?: FindOptions
  ): Promise<Review | null> {
    return await this.findOne({
      where: { user_id, course_id },
      ...options,
    });
  }

  /**
   * Find review with user and course details
   */
  async findByIdWithDetails(id: string, options?: FindOptions): Promise<Review | null> {
    return await this.findById(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'profile_thumbnail'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail', 'instructor_id'],
        },
      ],
      ...options,
    });
  }

  /**
   * Find review with course details (for instructor response)
   */
  async findByIdWithCourse(id: string, options?: FindOptions): Promise<Review | null> {
    return await this.findById(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['instructor_id'],
        },
      ],
      ...options,
    });
  }

  /**
   * Get reviews for a specific course with pagination
   */
  async findByCourseId(
    course_id: string,
    options: PaginationOptions = {}
  ): Promise<{ reviews: Review[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, rating } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { course_id };

    if (rating) {
      whereClause.rating = rating;
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_thumbnail'],
        },
      ],
      limit,
      offset,
      // distinct: true,
      order: [['created_at', 'DESC']],
    });

    return {
      reviews: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Get reviews for courses by instructor
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ reviews: Review[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await this.findAndCountAll({
      include: [
        {
          model: Course,
          as: 'course',
          where: { instructor_id },
          attributes: ['id', 'title', 'thumbnail'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_thumbnail'],
        },
      ],
      limit,
      offset,
      // distinct: true,
      order: [['created_at', 'DESC']],
    });

    return {
      reviews: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Get average rating for a course
   */
  async getAverageRating(course_id: string): Promise<number> {
    const result = (await Review.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'averageRating']],
      where: { course_id },
      raw: true,
    })) as unknown as AverageRatingResult;

    const avg = result?.averageRating;
    return avg ? parseFloat(Number(avg).toFixed(1)) : 0;
  }

  /**
   * Get rating distribution for a course
   */
  async getRatingDistribution(course_id: string): Promise<{ [key: number]: number }> {
    const results = (await Review.findAll({
      attributes: ['rating', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { course_id },
      group: ['rating'],
      raw: true,
    })) as unknown as RatingCountResult[];

    // Initialize distribution with zeros for all ratings 1-5
    const distribution: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    // Fill in actual counts
    results.forEach(result => {
      distribution[result.rating] = parseInt(String(result.count));
    });

    return distribution;
  }

  /**
   * Get highest rated courses using raw SQL query
   */
  async getHighestRatedCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    // Use Sequelize's raw query capabilities for a more optimized query
    const coursesWithAvgRating = (await sequelize.query(
      `
      SELECT 
        c.id, 
        c.title, 
        c.thumbnail, 
        c.price,
        c.instructor_id,
        AVG(r.rating) AS average_rating,
        COUNT(r.id) AS review_count
      FROM 
        courses c
      INNER JOIN 
        reviews r ON c.id = r.course_id
      WHERE 
        c.is_published = true AND c.is_approved = true
      GROUP BY 
        c.id
      ORDER BY 
        average_rating DESC, review_count DESC
      LIMIT :limit OFFSET :offset
    `,
      {
        replacements: { limit, offset },
        type: QueryTypes.SELECT,
      }
    )) as unknown as HighestRatedCourseResult[];

    // Get the total count of courses with reviews
    const totalResult = (await sequelize.query(
      `
      SELECT COUNT(DISTINCT c.id) AS total
      FROM courses c
      INNER JOIN reviews r ON c.id = r.course_id
      WHERE c.is_published = true AND c.is_approved = true
    `,
      {
        type: QueryTypes.SELECT,
      }
    )) as unknown as { total: number }[];

    const total = totalResult[0].total;

    return {
      courses: coursesWithAvgRating,
      total,
      page,
      limit,
    };
  }

  /**
   * Update instructor response
   */
  async updateInstructorResponse(
    id: string,
    instructor_response: string,
    transaction?: Transaction
  ): Promise<Review | null> {
    return await this.updateById(
      id,
      {
        instructor_response,
        response_date: new Date(),
      },
      { transaction }
    );
  }
}

export default new ReviewRepository();
