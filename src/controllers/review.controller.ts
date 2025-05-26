import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { Role } from '../models/user-role.model';
import reviewService from '../services/review.service';

class ReviewController {
  /**
   * Create or update a review
   * @route POST /api/reviews
   * @access Private - Student
   */
  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: user_id } = req.user!; // From auth middleware
      const { course_id, rating, review_text } = req.body;

      // Validate inputs
      if (!course_id) {
        throw new ApiError(400, 'Course ID is required');
      }
      if (!rating || rating < 1 || rating > 5) {
        throw new ApiError(400, 'Valid rating between 1 and 5 is required');
      }

      const review = await reviewService.createReview(user_id, course_id, rating, review_text);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get review by ID
   * @route GET /api/reviews/:id
   * @access Public
   */
  async getReviewById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const review = await reviewService.getReviewById(id);

      res.status(200).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's review for a specific course
   * @route GET /api/reviews/course/:courseId/user
   * @access Private - Student
   */
  async getUserReviewForCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: user_id } = req.user!; // From auth middleware
      const { courseId } = req.params;

      const review = await reviewService.getUserReviewForCourse(user_id, courseId);

      res.status(200).json({
        success: true,
        data: review ? review : { reviewed: false },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a review
   * @route PUT /api/reviews/:id
   * @access Private - Student
   */
  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: user_id } = req.user!; // From auth middleware
      const { id } = req.params;
      const { rating, review_text } = req.body;

      // Validate at least one update field is provided
      if (!rating && !review_text) {
        throw new ApiError(400, 'Rating or review text is required for update');
      }

      // Validate rating if provided
      if (rating && (rating < 1 || rating > 5)) {
        throw new ApiError(400, 'Valid rating between 1 and 5 is required');
      }

      const updates: { rating?: number; review_text?: string } = {};
      if (rating) updates.rating = rating;
      if (review_text !== undefined) updates.review_text = review_text;

      const review = await reviewService.updateReview(id, user_id, updates);

      res.status(200).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a review
   * @route DELETE /api/reviews/:id
   * @access Private - Student
   */
  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: user_id } = req.user!; // From auth middleware
      const { id } = req.params;

      await reviewService.deleteReview(id, user_id);

      res.status(200).json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add instructor response to a review
   * @route POST /api/reviews/:id/response
   * @access Private - Instructor
   */
  async addInstructorResponse(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: user_id } = req.user!; // From auth middleware
      const { id } = req.params;
      const { instructor_response } = req.body;

      if (!instructor_response) {
        throw new ApiError(400, 'Instructor response is required');
      }

      const review = await reviewService.addInstructorResponse(id, user_id, instructor_response);

      res.status(200).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all reviews for a course
   * @route GET /api/reviews/course/:courseId
   * @access Public
   */
  async getCourseReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const { page, limit, rating } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        rating: rating ? parseInt(rating as string) : undefined,
      };

      const result = await reviewService.getCourseReviews(courseId, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get average rating for a course
   * @route GET /api/reviews/course/:courseId/average
   * @access Public
   */
  async getAverageRating(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const averageRating = await reviewService.getAverageRating(courseId);

      res.status(200).json({
        success: true,
        data: {
          course_id: courseId,
          average_rating: averageRating,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get rating distribution for a course
   * @route GET /api/reviews/course/:courseId/distribution
   * @access Public
   */
  async getRatingDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const distribution = await reviewService.getRatingDistribution(courseId);

      res.status(200).json({
        success: true,
        data: {
          course_id: courseId,
          distribution,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all reviews for courses by an instructor
   * @route GET /api/reviews/instructor/:instructorId
   * @access Private - Instructor, Admin
   */
  async getInstructorReviews(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if user is authorized (instructor viewing own reviews or admin)
      const { id: user_id } = req.user!;
      const roles = req.user?.roles || [];
      const { instructorId } = req.params;

      if (!roles.includes(Role.ADMIN) && user_id !== instructorId) {
        throw new ApiError(403, 'You can only access reviews for your own courses');
      }

      const { page, limit } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const result = await reviewService.getInstructorReviews(instructorId, options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get highest rated courses
   * @route GET /api/reviews/highest-rated
   * @access Public
   */
  async getHighestRatedCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const result = await reviewService.getHighestRatedCourses(options);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReviewController();
