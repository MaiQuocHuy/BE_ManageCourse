import { Transaction } from 'sequelize';
import { reviewRepository, enrollmentRepository, userRepository } from '../repositories';
import Review from '../models/review.model';
import User from '../models/user.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

interface PaginationOptions {
  page?: number;
  limit?: number;
  rating?: number;
  search?: string;
}

class ReviewService {
  /**
   * Create a new review or update if exists
   */
  async createReview(
    user_id: string,
    course_id: string,
    rating: number,
    review_text?: string
  ): Promise<Review> {
    let transaction: Transaction | null = null;

    try {
      // Check if user is enrolled in the course using repository
      const enrollment = await enrollmentRepository.findByUserAndCourse(user_id, course_id);

      if (!enrollment) {
        throw new ApiError(403, 'You must be enrolled in the course to leave a review');
      }

      // Start a transaction
      transaction = await sequelize.transaction();

      // Check if the user has already reviewed this course using repository
      const existingReview = await reviewRepository.findByUserAndCourse(user_id, course_id, {
        transaction,
      });

      let review;

      if (existingReview) {
        // Update the existing review using repository update method with where clause
        await reviewRepository.update(
          {
            rating,
            review_text: review_text || existingReview.review_text,
          },
          { user_id, course_id },
          { transaction }
        );
        // Get the updated review
        review = await reviewRepository.findByUserAndCourse(user_id, course_id, { transaction });
      } else {
        // Create a new review using repository
        review = await reviewRepository.create(
          {
            user_id,
            course_id,
            rating,
            review_text,
          },
          { transaction }
        );
      }

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return review!;
    } catch (error) {
      // Rollback transaction on error if it's still active
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Get review by ID
   */
  async getReviewById(id: string): Promise<Review> {
    const review = await reviewRepository.findByIdWithDetails(id);

    if (!review) {
      throw new ApiError(404, 'Review not found');
    }

    return review;
  }

  /**
   * Get user's review for a specific course
   */
  async getUserReviewForCourse(user_id: string, course_id: string): Promise<Review | null> {
    return await reviewRepository.findByUserAndCourse(user_id, course_id);
  }

  /**
   * Update review
   */
  async updateReview(
    id: string,
    user_id: string, // For authorization check
    updates: { rating?: number; review_text?: string }
  ): Promise<Review> {
    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Find the review using repository
      const review = await reviewRepository.findById(id, { transaction });

      if (!review) {
        throw new ApiError(404, 'Review not found');
      }

      // Check if the user owns this review
      if (review.user_id !== user_id) {
        throw new ApiError(403, 'You can only update your own reviews');
      }

      // Update the review using repository with proper where clause
      await reviewRepository.update(updates, { id }, { transaction });

      // Get the updated review
      const updatedReview = await reviewRepository.findById(id, { transaction });

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return updatedReview!;
    } catch (error) {
      // Rollback transaction on error if it's still active
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Delete review
   */
  async deleteReview(id: string, user_id: string): Promise<boolean> {
    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Find the review using repository
      const review = await reviewRepository.findById(id, { transaction });

      if (!review) {
        throw new ApiError(404, 'Review not found');
      }

      // Check if the user owns this review
      if (review.user_id !== user_id) {
        throw new ApiError(403, 'You can only delete your own reviews');
      }

      // Delete the review using repository
      const deleted = await reviewRepository.deleteById(id, { transaction });

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return deleted;
    } catch (error) {
      // Rollback transaction on error if it's still active
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Add instructor response to a review
   */
  async addInstructorResponse(
    id: string,
    instructor_id: string, // For authorization check
    instructor_response: string
  ): Promise<Review> {
    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Find the review with course information using repository
      const review = await reviewRepository.findByIdWithCourse(id, { transaction });

      if (!review) {
        throw new ApiError(404, 'Review not found');
      }

      // Check if the instructor owns the course
      const courseData = review.get('course') as any;
      if (courseData.instructor_id !== instructor_id) {
        throw new ApiError(403, 'You can only respond to reviews for your own courses');
      }

      // Update the review with instructor's response using repository
      const updatedReview = await reviewRepository.updateInstructorResponse(
        id,
        instructor_response,
        transaction
      );

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return updatedReview!;
    } catch (error) {
      // Rollback transaction on error if it's still active
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Get all reviews for a course
   */
  async getCourseReviews(
    course_id: string,
    options: PaginationOptions = {}
  ): Promise<{ reviews: Review[]; total: number; page: number; limit: number }> {
    return await reviewRepository.findByCourseId(course_id, options);
  }

  /**
   * Get average rating for a course
   */
  async getAverageRating(course_id: string): Promise<number> {
    return await reviewRepository.getAverageRating(course_id);
  }

  /**
   * Get rating distribution for a course
   */
  async getRatingDistribution(course_id: string): Promise<{ [key: number]: number }> {
    return await reviewRepository.getRatingDistribution(course_id);
  }

  /**
   * Get all reviews for courses by an instructor
   */
  async getInstructorReviews(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ reviews: Review[]; total: number; page: number; limit: number }> {
    return await reviewRepository.findByInstructorId(instructor_id, options);
  }

  /**
   * Get highest rated courses
   */
  async getHighestRatedCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const result = await reviewRepository.getHighestRatedCourses(options);

    // Get instructor details for each course
    const courseIds = result.courses.map((course: any) => course.instructor_id);

    let instructors: { [key: string]: any } = {};

    if (courseIds.length > 0) {
      // Get all relevant instructors using repository
      const instructorResults = await userRepository.findAll({
        where: { id: courseIds },
        attributes: ['id', 'name', 'profile_thumbnail'],
      });

      // Create a lookup map
      instructorResults.forEach(instructor => {
        instructors[instructor.id] = instructor;
      });
    }

    // Format the results
    const courses = result.courses.map((course: any) => ({
      id: course.id,
      title: course.title,
      thumbnail: course.thumbnail,
      price: course.price,
      average_rating: parseFloat(course.average_rating.toFixed(1)),
      review_count: parseInt(String(course.review_count)),
      instructor: instructors[course.instructor_id]
        ? {
            id: instructors[course.instructor_id].id,
            name: instructors[course.instructor_id].name,
            profile_thumbnail: instructors[course.instructor_id].profile_thumbnail,
          }
        : null,
    }));

    return {
      courses,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}

export default new ReviewService();
