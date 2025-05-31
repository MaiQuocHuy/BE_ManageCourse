import { Request, Response, NextFunction } from "express";
import courseService from "../services/course.service";

class CourseController {
  /**
   * Initialize course tables
   */
  async initCourseTable(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await courseService.initCourseTable();

      res.status(200).json({
        success: true,
        message: "Course tables initialized successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new course
   */
  async createCourse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, price, categories } = req.body;
      const instructor_id = req.user!.id;
      const thumbnail = req.file;

      const course = await courseService.createCourse({
        title,
        description,
        instructor_id,
        price: parseFloat(price),
        thumbnail,
        categories: categories ? categories.split(",") : [],
      });

      res.status(201).json({
        success: true,
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a course by ID
   */
  async getCourseById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const course = await courseService.getCourseById(id);

      res.status(200).json({
        success: true,
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a course
   */
  async updateCourse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user?.id || '';
      const updatedCourse = await courseService.updateCourse(
        courseId,
        {
          ...req.body,
          thumbnail: req.file,
        },
        userId
      );

      res.json({
        success: true,
        message: 'Course updated successfully',
        data: updatedCourse,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a course
   */
  async deleteCourse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const currentUserId = req.user!.id;

      await courseService.deleteCourse(id, currentUserId);

      res.status(200).json({
        success: true,
        message: "Course deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a course (admin only)
   */
  async approveCourse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const { is_approved } = req.body;

      const course = await courseService.approveCourse(
        id,
        is_approved === "true" || is_approved === true
      );

      res.status(200).json({
        success: true,
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update course publication status
   */
  async updateCourseStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const { is_published } = req.body;
      const currentUserId = req.user!.id;

      const course = await courseService.updateCourseStatus(
        id,
        is_published === "true" || is_published === true,
        currentUserId
      );

      res.status(200).json({
        success: true,
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all courses for moderation (admin only)
   */
  async getAllCoursesForModeration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const status = req.query.status as string;
      const result = await courseService.getAllCoursesForModeration({
        page,
        limit,
        status,
      });

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get categories for a course
   */
  async getCourseCategories(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.id;
      const categories = await courseService.getCourseCategories(course_id);

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all courses with pagination and filtering
   */
  async getCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const category_id = req.query.category_id as string | undefined;
      const is_published = req.query.is_published === 'false' ? false : true;
      const is_approved = req.query.is_approved === 'true' ? true : false;

      const result = await courseService.getCourses({
        page,
        limit,
        category_id,
        is_published,
        is_approved,
      });

      console.log(result.total);

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get courses by instructor ID
   */
  async getCoursesByInstructorId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const instructor_id = req.params.instructorId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const is_published = req.query.is_published === "true" ? true : false;
      const is_approved = req.query.is_approved === "true" ? true : false;

      const result = await courseService.getCoursesByInstructorId(
        instructor_id,
        {
          page,
          limit,
          is_published,
          is_approved,
        }
      );

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search courses by keyword
   */
  async searchCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const keyword = req.query.keyword as string;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const category_id = req.query.category_id as string | undefined;
      const is_published = req.query.is_published === 'false' ? false : true;
      const is_approved = req.query.is_approved === 'false' ? false : true;
      if (!keyword) {
        return next(new Error('Keyword is required for search'));
      }

      const result = await courseService.searchCourses({
        keyword,
        page,
        limit,
        category_id,
        is_published,
        is_approved,
      });

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recommended courses for a user
   */
  async getRecommendedCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user_id = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const result = await courseService.getRecommendedCourses(user_id, {
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CourseController();
