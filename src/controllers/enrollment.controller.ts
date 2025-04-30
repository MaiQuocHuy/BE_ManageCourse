import { Request, Response, NextFunction } from "express";
import enrollmentService from "../services/enrollment.service";
import { ApiError } from "../utils/api-error";
import courseService from "../services/course.service";
import { Role } from "../models/user-role.model";

class EnrollmentController {
  // Create a new enrollment
  async createEnrollment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { course_id } = req.body;
      const user_id = req.user?.id;

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      // Check if course exists and is published
      const course = await courseService.getCourseById(course_id);
      if (!course.is_published || !course.is_approved) {
        throw new ApiError(400, "Course is not available for enrollment");
      }

      const enrollment = await enrollmentService.createEnrollment(
        user_id,
        course_id
      );

      res.status(201).json({
        success: true,
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get enrollment by ID
  async getEnrollmentById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const enrollment = await enrollmentService.getEnrollmentById(id);

      // Check if user has permission to view this enrollment
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      // Only allow access if user is the student, the instructor of the course, or an admin
      if (
        !isAdmin &&
        enrollment.user_id !== user_id &&
        (!isInstructor ||
          (isInstructor &&
            (enrollment as any).course?.instructor_id !== user_id))
      ) {
        throw new ApiError(403, "You don't have permission to view this enrollment");
      }

      res.status(200).json({
        success: true,
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  // Check if user is enrolled in a course
  async checkEnrollment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { course_id } = req.query;
      const user_id = req.user?.id;

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      if (!course_id) {
        throw new ApiError(400, "Course ID is required");
      }

      const enrollment = await enrollmentService.isUserEnrolled(
        user_id,
        course_id as string
      );

      res.status(200).json({
        success: true,
        data: {
          is_enrolled: !!enrollment,
          enrollment: enrollment,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all courses a user is enrolled in
  async getUserEnrollments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, search } = req.query;
      const user_id = req.params.userId || req.user?.id;

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      // Check if user has permission to view enrollments
      if (req.params.userId && req.params.userId !== req.user?.id) {
        const roles = req.user?.roles || [];
        if (!roles.includes(Role.ADMIN)) {
          throw new ApiError(
            403,
            "You don't have permission to view other users' enrollments"
          );
        }
      }

      const enrollments = await enrollmentService.getUserEnrollments(
        user_id as string,
        {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          search: search as string,
        }
      );

      res.status(200).json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all students enrolled in a course
  async getCourseEnrollments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { courseId } = req.params;
      const { page, limit, search } = req.query;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      // Check if user has permission to view course enrollments
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && !isInstructor) {
        throw new ApiError(
          403,
          "You don't have permission to view course enrollments"
        );
      }

      // If instructor, check if they own the course
      if (isInstructor && !isAdmin) {
        const course = await courseService.getCourseById(courseId);
        if (course.instructor_id !== user_id) {
          throw new ApiError(
            403,
            "You don't have permission to view enrollments for this course"
          );
        }
      }

      const enrollments = await enrollmentService.getCourseEnrollments(
        courseId,
        {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          search: search as string,
        }
      );

      res.status(200).json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }

  // Calculate the total revenue generated by a course
  async getCourseRevenue(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { courseId } = req.params;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      // Check if user has permission to view course revenue
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && !isInstructor) {
        throw new ApiError(
          403,
          "You don't have permission to view course revenue"
        );
      }

      // If instructor, check if they own the course
      if (isInstructor && !isAdmin) {
        const course = await courseService.getCourseById(courseId);
        if (course.instructor_id !== user_id) {
          throw new ApiError(
            403,
            "You don't have permission to view revenue for this course"
          );
        }
      }

      const revenue = await enrollmentService.getCourseRevenue(courseId);

      res.status(200).json({
        success: true,
        data: {
          revenue,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get the number of unique students enrolled in an instructor's courses
  async getStudentCountByInstructor(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { instructorId } = req.params;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, "Not authenticated");
      }

      // Check if user has permission to view student count
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && (!isInstructor || instructorId !== user_id)) {
        throw new ApiError(
          403,
          "You don't have permission to view this information"
        );
      }

      const studentCount = await enrollmentService.getStudentCountByInstructor(
        instructorId
      );

      res.status(200).json({
        success: true,
        data: {
          student_count: studentCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get the most popular courses based on enrollment count
  async getMostPopularCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;

      const popularCourses = await enrollmentService.getMostPopularCourses({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.status(200).json({
        success: true,
        data: popularCourses,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new EnrollmentController();
