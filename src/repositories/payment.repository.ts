import { Op, FindOptions, Transaction } from 'sequelize';
import Payment from '../models/payment.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';
import { PaymentStatus } from '../models/payment.model';
import sequelize from '../config/database';
import { getPaymentCount } from '../utils/paymentStatsHelper';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_method?: string;
  start_date?: Date;
  end_date?: Date;
}

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super(Payment);
  }

  /**
   * Find payment by transaction ID
   */
  async findByTransactionId(
    transaction_id: string,
    options?: FindOptions
  ): Promise<Payment | null> {
    return await this.findOne({
      where: { transaction_id },
      ...options,
    });
  }

  /**
   * Find payment with user and course details
   */
  async findByIdWithDetails(id: string, options?: FindOptions): Promise<Payment | null> {
    return await this.findById(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'instructor_id'],
          include: [
            {
              model: User,
              as: 'instructor',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
      ...options,
    });
  }

  /**
   * Find payments by user ID
   */
  async findByUserId(
    user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, status } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { user_id };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail', 'price'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      payments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find payments by instructor ID
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, status, start_date, end_date } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (start_date && end_date) {
      whereClause.created_at = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      whereClause.created_at = { [Op.gte]: start_date };
    } else if (end_date) {
      whereClause.created_at = { [Op.lte]: end_date };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          where: { instructor_id },
          attributes: ['id', 'title', 'price'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      payments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find payments with advanced filtering
   */
  async findWithFilter(
    options: PaginationOptions = {}
  ): Promise<{ payments: Payment[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, status, payment_method, start_date, end_date } = options;
    const offset = (page - 1) * limit;
    console.log("Checking")

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (payment_method) {
      whereClause.payment_method = payment_method;
    }

    if (start_date && end_date) {
      whereClause.created_at = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      whereClause.created_at = { [Op.gte]: start_date };
    } else if (end_date) {
      whereClause.created_at = { [Op.lte]: end_date };
    }

    let userWhere: any = {};
    let courseWhere: any = {};

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
          as: 'user',
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          where: Object.keys(courseWhere).length > 0 ? courseWhere : undefined,
          attributes: ['id', 'title', 'price'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      payments: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Update payment status
   */
  async updateStatus(
    id: string,
    status: string,
    transaction?: Transaction
  ): Promise<Payment | null> {
    return await this.updateById(id, { status }, { transaction });
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(instructor_id?: string): Promise<{
    totalPayments: number;
    totalRevenue: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    recentPayments: number;
    recentRevenue: number;
  }> {
    const courseWhere: any = instructor_id ? { instructor_id } : {};

    const includeOptions = instructor_id
      ? [
          {
            model: Course,
            as: 'course',
            where: courseWhere,
            attributes: [],
          },
        ]
      : [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const notRefundedStatus = {
      status: {
        [Op.ne]: 'refunded',
      },
    };

    const [
      totalPayments,
      successfulPayments,
      pendingPayments,
      failedPayments,
      recentPayments,
      revenueResult,
      recentRevenueResult,
    ] = await Promise.all([
      getPaymentCount(notRefundedStatus, instructor_id),
      getPaymentCount({ status: 'completed' }, instructor_id),
      getPaymentCount({ status: 'pending' }, instructor_id),
      getPaymentCount({ status: 'failed' }, instructor_id),
      getPaymentCount(
        { ...notRefundedStatus, created_at: { [Op.gte]: thirtyDaysAgo } },
        instructor_id
      ),

      Payment.findOne({
        attributes: [
          [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'totalRevenue'],
        ],
        where: {
          ...notRefundedStatus,
          status: 'completed',
        },
        include: includeOptions,
        raw: true,
      }),

      Payment.findOne({
        attributes: [
          [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'recentRevenue'],
        ],
        where: {
          ...notRefundedStatus,
          status: 'completed',
          created_at: { [Op.gte]: thirtyDaysAgo },
        },
        include: includeOptions,
        raw: true,
      }),
    ]);

    const totalRevenue = parseFloat((revenueResult as any)?.totalRevenue || '0');
    const recentRevenue = parseFloat((recentRevenueResult as any)?.recentRevenue || '0');

    return {
      totalPayments,
      totalRevenue,
      successfulPayments,
      pendingPayments,
      failedPayments,
      recentPayments,
      recentRevenue,
    };
  }

  /**
   * Get revenue by period
   */
  async getRevenueByPeriod(
    period: 'day' | 'week' | 'month' | 'year',
    instructor_id?: string,
    limit: number = 30
  ): Promise<any[]> {
    let dateFormat: string;

    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const whereClause: any = {
      status: PaymentStatus.COMPLETED,
    };

    const includeOptions: any[] = [];

    if (instructor_id) {
      includeOptions.push({
        model: Course,
        as: 'course',
        attributes: [],
        where: { instructor_id },
        required: true,
      });
    }

    return await Payment.findAll({
      attributes: [
        [
          Payment.sequelize!.fn('DATE_FORMAT', Payment.sequelize!.col('created_at'), dateFormat),
          'period',
        ],
        [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'revenue'],
        [Payment.sequelize!.fn('COUNT', Payment.sequelize!.col('Payment.id')), 'payment_count'],
      ],
      where: whereClause,
      include: includeOptions,
      group: [
        Payment.sequelize!.fn('DATE_FORMAT', Payment.sequelize!.col('created_at'), dateFormat),
      ],
      order: [[Payment.sequelize!.literal('period'), 'DESC']],
      limit,
      raw: true,
    });
  }

  /**
   * Get top earning courses
   * @param instructor_id Optional instructor ID to filter by
   * @param limit Number of courses to return
   * @param start_date Start date for revenue calculation
   * @param end_date End date for revenue calculation
   * @returns Array of courses with revenue information
   */
  async getTopEarningCourses(
    instructor_id?: string,
    limit: number = 10,
    start_date?: Date,
    end_date?: Date
  ): Promise<any[]> {
    // Build where clause for payment conditions
    const whereClause: any = {
      status: PaymentStatus.COMPLETED,
    };

    // Add date range filter if both dates are provided
    if (start_date && end_date) {
      whereClause.created_at = {
        [Op.between]: [start_date, end_date],
      };
    }

    // Build course include with filter if needed
    const courseInclude: any = {
      model: Course,
      as: 'course',
      attributes: ['id', 'title', 'thumbnail', 'price'],
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
    };

    // Add instructor filter if provided
    if (instructor_id) {
      courseInclude.where = { instructor_id };
    }

    // Execute optimized query
    const results = await Payment.findAll({
      attributes: [
        'course_id',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
        [sequelize.fn('COUNT', sequelize.col('Payment.id')), 'sales_count'],
      ],
      where: whereClause,
      include: [courseInclude],
      group: ['course_id', 'course.id', 'course.instructor.id'],
      order: [[sequelize.literal('total_revenue'), 'DESC']],
      limit,
      subQuery: false, // Improve performance by avoiding subqueries
      raw: false,
    });

    // Transform results to ensure consistent format
    return results.map((result: any) => {
      const plainResult = result.get({ plain: true });

      // Format revenue as number
      if (plainResult.total_revenue) {
        plainResult.total_revenue = parseFloat(plainResult.total_revenue);
      }

      // Format sales count as integer
      if (plainResult.sales_count) {
        plainResult.sales_count = parseInt(plainResult.sales_count.toString(), 10);
      }

      return plainResult;
    });
  }

  /**
   * Check if user has paid for course
   */
  async hasUserPaidForCourse(user_id: string, course_id: string): Promise<boolean> {
    return await this.exists({
      user_id,
      course_id,
      status: 'completed',
    });
  }

  /**
   * Get refundable payments (completed and within refund period)
   */
  async getRefundablePayments(days: number = 30): Promise<Payment[]> {
    const refundDeadline = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.findAll({
      where: {
        status: 'completed',
        created_at: { [Op.gte]: refundDeadline },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price'],
        },
      ],
    });
  }

  /**
   * Get payment methods statistics
   */
  async getPaymentMethodStats(instructor_id?: string): Promise<any[]> {
    let includeOptions: any[] = [];

    if (instructor_id) {
      includeOptions.push({
        model: Course,
        as: 'course',
        where: { instructor_id },
        attributes: [],
      });
    }

    return await Payment.findAll({
      attributes: [
        'payment_method',
        [Payment.sequelize!.fn('COUNT', Payment.sequelize!.col('Payment.id')), 'count'],
        [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'total_amount'],
      ],
      where: { status: 'completed' },
      include: includeOptions,
      group: ['payment_method'],
      order: [[Payment.sequelize!.literal('count'), 'DESC']],
      raw: true,
    });
  }
}

export default new PaymentRepository();
