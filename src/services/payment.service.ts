import { Transaction } from 'sequelize';
import {
  paymentRepository,
  userRepository,
  courseRepository,
  enrollmentRepository,
} from '../repositories';
import Payment, { PaymentStatus } from '../models/payment.model';
import Refund, { RefundStatus } from '../models/refund.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';
import { parsePeriodToDate } from '../utils/date';

interface PaginationOptions {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  start_date?: Date;
  end_date?: Date;
}

class PaymentService {
  /**
   * Create a new payment
   */
  async createPayment(
    user_id: string,
    course_id: string,
    amount: number,
    currency: string,
    payment_method: string,
    transaction_id?: string,
    metadata?: any
  ): Promise<Payment> {
    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Check if course exists using repository
      const course = await courseRepository.findById(course_id);
      if (!course) {
        throw new ApiError(404, 'Course not found');
      }

      // Check if user exists using repository
      const user = await userRepository.findById(user_id);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if user is already enrolled in the course using repository
      const existingEnrollment = await enrollmentRepository.findByUserAndCourse(
        user_id,
        course_id,
        { transaction }
      );

      if (existingEnrollment) {
        throw new ApiError(400, 'User is already enrolled in this course');
      }

      // Create payment record using repository
      const payment = await paymentRepository.create(
        {
          user_id,
          course_id,
          amount,
          currency,
          payment_method,
          status: PaymentStatus.PENDING.toString(),
          transaction_id,
          metadata,
        },
        { transaction }
      );

      // Create enrollment record using repository
      await enrollmentRepository.create(
        {
          user_id,
          course_id,
        },
        { transaction }
      );

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return payment;
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
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment> {
    const payment = await paymentRepository.findByIdWithDetails(id);

    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }

    return payment;
  }

  /**
   * Get all payments for a user
   */
  async getUserPayments(
    user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    return await paymentRepository.findByUserId(user_id, options);
  }

  /**
   * Get all payments for a course
   */
  async getCoursePayments(
    course_id: string,
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    // This would need to be implemented in the repository as findByCourseId
    // For now, use basic filtering
    return await paymentRepository.findWithFilter({
      ...options,
      // Add course_id filter logic here
    });
  }

  /**
   * Get payments by instructor ID
   */
  async getInstructorPayments(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    return await paymentRepository.findByInstructorId(instructor_id, options);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(id: string, status: string): Promise<Payment> {
    const updatedPayment = await paymentRepository.updateStatus(id, status);

    if (!updatedPayment) {
      throw new ApiError(404, 'Payment not found');
    }

    return updatedPayment;
  }

  /**
   * Process refund for a payment
   */
  async processRefund(payment_id: string, reason: string, amount?: number): Promise<Refund> {
    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Get payment using repository
      const payment = await paymentRepository.findById(payment_id, { transaction });

      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      // Check if payment is completed
      if (payment.status !== PaymentStatus.COMPLETED.toString()) {
        throw new ApiError(400, 'Only completed payments can be refunded');
      }

      // Check if payment is already refunded
      if (payment.status === PaymentStatus.REFUNDED.toString()) {
        throw new ApiError(400, 'Payment is already refunded');
      }

      // Set refund amount to full payment amount if not specified
      const refundAmount = amount || Number(payment.amount);

      // Check if refund amount is valid
      if (refundAmount <= 0 || refundAmount > Number(payment.amount)) {
        throw new ApiError(400, 'Refund amount must be positive and not exceed the payment amount');
      }

      // Create refund record
      const refund = await Refund.create(
        {
          payment_id,
          amount: refundAmount,
          reason,
          status: RefundStatus.COMPLETED.toString(),
        },
        { transaction }
      );

      // Update payment status using repository
      await paymentRepository.updateStatus(
        payment_id,
        PaymentStatus.REFUNDED.toString(),
        transaction
      );

      // If full refund, remove enrollment using repository
      if (refundAmount === Number(payment.amount)) {
        await enrollmentRepository.delete(
          {
            user_id: payment.user_id,
            course_id: payment.course_id,
          },
          { transaction }
        );
      }

      // Commit transaction
      await transaction.commit();
      transaction = null;

      return refund;
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
   * Calculate total revenue from all payments
   */
  async getTotalRevenue(): Promise<number> {
    const stats = await paymentRepository.getPaymentStats();
    return stats.totalRevenue;
  }

  isPeriodInRange(period: string, startDate: Date, endDate: Date): boolean {
    const periodDate = parsePeriodToDate(period);
    if (!periodDate) return false;

    // Nếu period là kiểu 'YYYY' thì cần xử lý đặc biệt
    if (/^\d{4}$/.test(period)) {
      const year = parseInt(period, 10);
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      return year >= startYear && year <= endYear;
    }

    return periodDate >= startDate && periodDate <= endDate;
  }

  /**
   * Calculate revenue by time period
   */
  async getRevenueByTime(
    startDate: Date,
    endDate: Date,
    period: 'day' | 'week' | 'month' | 'year' = 'day'
  ): Promise<{ period: string; amount: number }[]> {
    const results = await paymentRepository.getRevenueByPeriod(period, undefined, 100);

    // Filter results by date range
    return results
      .filter(result => this.isPeriodInRange(result.period, startDate, endDate))
      .map(result => ({
        period: result.period,
        amount: Number(result.revenue),
      }));
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStatistics(
    startDate?: Date,
    endDate?: Date,
    instructor_id?: string
  ): Promise<{
    total: number;
    average: number;
    growth: number;
    transactions: number;
  }> {
    // Get payment statistics using repository
    const stats = await paymentRepository.getPaymentStats(instructor_id);
    console.log('Stats', stats);

    // For growth calculation, we would need to implement date range filtering in repository
    // For now, return basic stats
    const average = stats.totalPayments > 0 ? stats.totalRevenue / stats.totalPayments : 0;

    return {
      total: stats.totalRevenue,
      average: Number(average),
      growth: 0, // Would need historical data comparison
      transactions: stats.totalPayments,
    };
  }

  /**
   * Get instructor revenue
   */
  async getInstructorRevenue(
    instructor_id: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const stats = await paymentRepository.getPaymentStats(instructor_id);
    return stats.totalRevenue;
  }

  /**
   * Get highest revenue courses
   */
  async getHighestRevenueCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, start_date, end_date } = options;

    const results = await paymentRepository.getTopEarningCourses(
      undefined,
      limit,
      start_date,
      end_date
    );

    return {
      courses: results,
      total: results.length,
      page,
      limit,
    };
  }

  /**
   * Get instructor's highest revenue courses
   */
  async getInstructorHighestRevenueCourses(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;

    const results = await paymentRepository.getTopEarningCourses(instructor_id, limit);

    return {
      courses: results,
      total: results.length,
      page,
      limit,
    };
  }

  /**
   * Check if user has paid for course
   */
  async hasUserPaidForCourse(user_id: string, course_id: string): Promise<boolean> {
    return await paymentRepository.hasUserPaidForCourse(user_id, course_id);
  }

  /**
   * Get refundable payments
   */
  async getRefundablePayments(days: number = 30): Promise<Payment[]> {
    return await paymentRepository.getRefundablePayments(days);
  }

  /**
   * Get payment method statistics
   */
  async getPaymentMethodStats(instructor_id?: string): Promise<any[]> {
    return await paymentRepository.getPaymentMethodStats(instructor_id);
  }

  /**
   * Get payment statistics for admin/instructor dashboard
   */
  async getPaymentStats(instructor_id?: string): Promise<{
    totalPayments: number;
    totalRevenue: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    recentPayments: number;
  }> {
    return await paymentRepository.getPaymentStats(instructor_id);
  }
}

export default new PaymentService();
