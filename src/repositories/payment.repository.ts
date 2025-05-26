import { Op, FindOptions, Transaction } from 'sequelize';
import Payment from '../models/payment.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';

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
      order: [['payment_date', 'DESC']],
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
      whereClause.payment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      whereClause.payment_date = { [Op.gte]: start_date };
    } else if (end_date) {
      whereClause.payment_date = { [Op.lte]: end_date };
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
      order: [['payment_date', 'DESC']],
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

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (payment_method) {
      whereClause.payment_method = payment_method;
    }

    if (start_date && end_date) {
      whereClause.payment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      whereClause.payment_date = { [Op.gte]: start_date };
    } else if (end_date) {
      whereClause.payment_date = { [Op.lte]: end_date };
    }

    let userWhere: any = {};
    let courseWhere: any = {};

    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
      courseWhere.title = { [Op.iLike]: `%${search}%` };
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
      order: [['payment_date', 'DESC']],
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
  }> {
    let whereClause: any = {};
    let courseWhere: any = {};

    if (instructor_id) {
      courseWhere.instructor_id = instructor_id;
    }

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

    const [totalPayments, successfulPayments, pendingPayments, failedPayments, recentPayments] =
      await Promise.all([
        this.count({
          include: includeOptions,
        }),
        this.count({
          where: { status: 'completed' },
          include: includeOptions,
        }),
        this.count({
          where: { status: 'pending' },
          include: includeOptions,
        }),
        this.count({
          where: { status: 'failed' },
          include: includeOptions,
        }),
        this.count({
          where: {
            payment_date: {
              [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          include: includeOptions,
        }),
      ]);

    // Calculate total revenue
    const revenueResult = await Payment.findOne({
      attributes: [
        [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'totalRevenue'],
      ],
      where: { status: 'completed' },
      include: includeOptions,
      raw: true,
    });

    const totalRevenue = parseFloat((revenueResult as any)?.totalRevenue || '0');

    return {
      totalPayments,
      totalRevenue,
      successfulPayments,
      pendingPayments,
      failedPayments,
      recentPayments,
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
    let dateInterval: string;

    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        dateInterval = '1 day';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        dateInterval = '1 week';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        dateInterval = '1 month';
        break;
      case 'year':
        dateFormat = '%Y';
        dateInterval = '1 year';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        dateInterval = '1 day';
    }

    let whereClause: any = { status: 'completed' };
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
        [
          Payment.sequelize!.fn('DATE_FORMAT', Payment.sequelize!.col('payment_date'), dateFormat),
          'period',
        ],
        [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'revenue'],
        [Payment.sequelize!.fn('COUNT', Payment.sequelize!.col('Payment.id')), 'payment_count'],
      ],
      where: whereClause,
      include: includeOptions,
      group: [
        Payment.sequelize!.fn('DATE_FORMAT', Payment.sequelize!.col('payment_date'), dateFormat),
      ],
      order: [[Payment.sequelize!.literal('period'), 'DESC']],
      limit,
      raw: true,
    });
  }

  /**
   * Get top earning courses
   */
  async getTopEarningCourses(instructor_id?: string, limit: number = 10): Promise<any[]> {
    let whereClause: any = { status: 'completed' };
    let courseWhere: any = {};

    if (instructor_id) {
      courseWhere.instructor_id = instructor_id;
    }

    return await Payment.findAll({
      attributes: [
        'course_id',
        [Payment.sequelize!.fn('SUM', Payment.sequelize!.col('amount')), 'total_revenue'],
        [Payment.sequelize!.fn('COUNT', Payment.sequelize!.col('Payment.id')), 'sales_count'],
      ],
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          where: Object.keys(courseWhere).length > 0 ? courseWhere : undefined,
          attributes: ['id', 'title', 'thumbnail', 'price'],
        },
      ],
      group: ['course_id', 'course.id'],
      order: [[Payment.sequelize!.literal('total_revenue'), 'DESC']],
      limit,
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
        payment_date: { [Op.gte]: refundDeadline },
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
