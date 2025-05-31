import { Request, Response, NextFunction } from 'express';

import { ApiError } from '../utils/api-error';
import { Role } from '../models/user-role.model';
import { PaymentStatus } from '../models/payment.model';
import paymentService from '../services/payment.service';
import courseService from '../services/course.service';
import { toVNDateRange } from '../utils/date';
import enrollmentService from '../services/enrollment.service';

class PaymentController {
  // Create a new payment
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { course_id, amount, currency = 'USD', payment_method } = req.body;
      const user_id = req.user?.id;

      if (!user_id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check if course exists and is published
      const course = await courseService.getCourseById(course_id);
      if (!course.is_published || !course.is_approved) {
        throw new ApiError(400, 'Course is not available for purchase');
      }

      // Check amount is not less than course price
      if (amount < course.price) {
        throw new ApiError(400, 'Amount is less than course price');
      }

      const paymentAmount = amount;

      const payment = await paymentService.createPayment(
        user_id,
        course_id,
        paymentAmount,
        currency,
        payment_method
      );

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get payment by ID
  async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      // Check if user has permission to view this payment
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      // Only allow access if user is the student, the instructor of the course, or an admin
      if (
        !isAdmin &&
        payment.user_id !== user_id &&
        (!isInstructor || (isInstructor && (payment as any).course?.instructor_id !== user_id))
      ) {
        throw new ApiError(403, "You don't have permission to view this payment");
      }

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all payments for a user
  async getUserPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status } = req.query;
      const current_user_id = req.user?.id;

      if (!current_user_id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Determine which user's payments to fetch
      let target_user_id: string;

      if (req.params.userId) {
        // Admin viewing specific user's payments
        const roles = req.user?.roles || [];
        if (!roles.includes(Role.ADMIN)) {
          throw new ApiError(403, "Only admin can view other users' payments");
        }
        target_user_id = req.params.userId;
      } else {
        // Current user viewing their own payments
        target_user_id = current_user_id;
      }

      const payments = await paymentService.getUserPayments(target_user_id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
      });

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all payments for a course
  async getCoursePayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { courseId } = req.params;
      const { page, limit, status, search } = req.query;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check if user has permission to view course payments
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && !isInstructor) {
        throw new ApiError(403, "You don't have permission to view course payments");
      }

      // If instructor, check if they own the course
      if (isInstructor && !isAdmin) {
        const course = await courseService.getCourseById(courseId);
        if (course.instructor_id !== user_id) {
          throw new ApiError(403, "You don't have permission to view payments for this course");
        }
      }

      const payments = await paymentService.getCoursePayments(courseId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        search: search as string,
      });

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update payment status
  async updatePaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const payment = await paymentService.updatePaymentStatus(id, status);

      //Check if payments' status is completed => auto create enrollment
      if (payment.status === PaymentStatus.COMPLETED) {
        await enrollmentService.createEnrollment(payment.user_id, payment.course_id);
      }

      res.status(200).json({
        success: true,
        message: 'Payment status updated successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  // Process refund
  async processRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, amount } = req.body;

      const refund = await paymentService.processRefund(id, reason, amount);

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: refund,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get total revenue
  async getTotalRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = req.user?.roles || [];

      // Only admin can view total revenue
      if (!roles.includes(Role.ADMIN)) {
        throw new ApiError(403, 'Only admin can view total revenue');
      }

      const totalRevenue = await paymentService.getTotalRevenue();

      res.status(200).json({
        success: true,
        data: {
          total_revenue: totalRevenue,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get revenue by time
  async getRevenueByTime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { start_date, end_date, period } = req.query;
      const roles = req.user?.roles || [];

      // Only admin can view revenue by time
      if (!roles.includes(Role.ADMIN)) {
        throw new ApiError(403, 'Only admin can view revenue by time');
      }

      if (!start_date || !end_date) {
        throw new ApiError(400, 'Start date and end date are required');
      }

      let startDate = start_date ? new Date(start_date as string) : undefined;
      let endDate = end_date ? new Date(end_date as string) : undefined;

      if (!startDate && !endDate) {
        throw new ApiError(400, 'Start date and end date are required');
      }

      if (startDate && endDate) {
        startDate = toVNDateRange(start_date as string);
        endDate = toVNDateRange(end_date as string, true);
      } else if (!startDate) {
        // If no start date, default to 30 days before end date
        startDate = new Date(endDate!.getTime());
        startDate.setDate(startDate.getDate() - 30);
      } else if (!endDate) {
        // If no end date, default to current date
        endDate = new Date();
      }

      const revenueByTime = await paymentService.getRevenueByTime(
        startDate!,
        endDate!,
        period as 'day' | 'week' | 'month' | 'year' | undefined
      );

      res.status(200).json({
        success: true,
        data: {
          revenue: revenueByTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get revenue statistics
  async getRevenueStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { start_date, end_date, instructor_id } = req.query;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check permissions
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && !isInstructor) {
        throw new ApiError(403, 'Only admin and instructor can view revenue statistics');
      }

      let targetInstructorId: string | undefined;

      // Determine which instructor's statistics to show
      if (isAdmin) {
        // Admin can view statistics for any instructor or overall statistics
        targetInstructorId = instructor_id as string;
      } else if (isInstructor) {
        // Instructor can only view their own statistics
        if (instructor_id && instructor_id !== user_id) {
          throw new ApiError(403, 'Instructor can only view their own revenue statistics');
        }
        targetInstructorId = user_id;
      }

      let startDate = start_date ? new Date(start_date as string) : undefined;
      let endDate = end_date ? new Date(end_date as string) : undefined;

      if (startDate && endDate) {
        startDate = toVNDateRange(start_date as string);
        endDate = toVNDateRange(end_date as string, true);
      }

      const statistics = await paymentService.getRevenueStatistics(
        startDate,
        endDate,
        targetInstructorId
      );

      res.status(200).json({
        success: true,
        data: {
          instructor_id: targetInstructorId,
          statistics,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get instructor revenue
  async getInstructorRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { instructorId } = req.params;
      const { start_date, end_date } = req.query;
      const user_id = req.user?.id;
      const roles = req.user?.roles || [];

      if (!user_id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check if user has permission to view instructor revenue
      const isAdmin = roles.includes(Role.ADMIN);
      const isInstructor = roles.includes(Role.INSTRUCTOR);

      if (!isAdmin && (!isInstructor || user_id !== instructorId)) {
        throw new ApiError(403, "You don't have permission to view this instructor's revenue");
      }

      let startDate = start_date ? new Date(start_date as string) : undefined;
      let endDate = end_date ? new Date(end_date as string) : undefined;

      if (!startDate && !endDate) {
        throw new ApiError(400, 'Start date and end date are required');
      }

      if (startDate && endDate) {
        startDate = toVNDateRange(start_date as string);
        endDate = toVNDateRange(end_date as string, true);
      }

      const revenue = await paymentService.getInstructorRevenue(instructorId, startDate!, endDate!);

      res.status(200).json({
        success: true,
        data: {
          instructor_id: instructorId,
          revenue,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get highest revenue courses
  async getHighestRevenueCourses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, start_date, end_date } = req.query;

      let startDate = start_date ? new Date(start_date as string) : undefined;
      let endDate = end_date ? new Date(end_date as string) : undefined;

      if (!startDate && !endDate) {
        throw new ApiError(400, 'Start date and end date are required');
      }

      if (startDate && endDate) {
        startDate = toVNDateRange(start_date as string);
        endDate = toVNDateRange(end_date as string, true);
      }

      const courses = await paymentService.getHighestRevenueCourses({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        start_date: startDate!,
        end_date: endDate!,
      });

      res.status(200).json({
        success: true,
        data: courses,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
