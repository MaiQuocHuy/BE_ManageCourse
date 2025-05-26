import { Op, FindOptions, Transaction, QueryTypes } from 'sequelize';
import LessonCompletion from '../models/lesson-completion.model';
import Lesson from '../models/lesson.model';
import Section from '../models/section.model';
import Course from '../models/course.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class LessonCompletionRepository extends BaseRepository<LessonCompletion> {
  constructor() {
    super(LessonCompletion);
  }

  /**
   * Find completion by user and lesson
   */
  async findByUserAndLesson(
    user_id: string,
    lesson_id: string,
    options?: FindOptions
  ): Promise<LessonCompletion | null> {
    return await this.findOne({
      where: { user_id, lesson_id },
      ...options,
    });
  }

  /**
   * Find completions by user ID with lesson details
   */
  async findByUserId(
    user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ completions: LessonCompletion[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let lessonWhere: any = {};
    if (search) {
      lessonWhere.title = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await this.findAndCountAll({
      where: { user_id },
      include: [
        {
          model: Lesson,
          as: 'lesson',
          where: Object.keys(lessonWhere).length > 0 ? lessonWhere : undefined,
          attributes: ['id', 'title', 'duration', 'section_id'],
          include: [
            {
              model: Section,
              as: 'section',
              attributes: ['id', 'title', 'course_id'],
              include: [
                {
                  model: Course,
                  as: 'course',
                  attributes: ['id', 'title'],
                },
              ],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [['completed_at', 'DESC']],
    });

    return {
      completions: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find completions by course ID for a user
   */
  async findByCourseAndUser(course_id: string, user_id: string): Promise<LessonCompletion[]> {
    return await this.findAll({
      where: { user_id },
      include: [
        {
          model: Lesson,
          as: 'lesson',
          include: [
            {
              model: Section,
              as: 'section',
              where: { course_id },
              attributes: ['id', 'title'],
            },
          ],
        },
      ],
      order: [['completed_at', 'ASC']],
    });
  }

  /**
   * Get course progress for a user
   */
  async getCourseProgress(
    course_id: string,
    user_id: string
  ): Promise<{
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
  }> {
    // Get total lessons in the course
    const totalLessons = await Lesson.count({
      include: [
        {
          model: Section,
          as: 'section',
          where: { course_id },
          attributes: [],
        },
      ],
    });

    // Get completed lessons count
    const completedResult = await LessonCompletion.findAll({
      attributes: [
        [
          LessonCompletion.sequelize!.fn(
            'COUNT',
            LessonCompletion.sequelize!.col('LessonCompletion.id')
          ),
          'count',
        ],
      ],
      where: { user_id },
      include: [
        {
          model: Lesson,
          as: 'lesson',
          attributes: [],
          include: [
            {
              model: Section,
              as: 'section',
              where: { course_id },
              attributes: [],
            },
          ],
        },
      ],
      raw: true,
    });

    const completedLessons = parseInt((completedResult as any)[0]?.count || '0');
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      totalLessons,
      completedLessons,
      progressPercentage,
    };
  }

  /**
   * Mark lesson as completed
   */
  async markLessonCompleted(
    user_id: string,
    lesson_id: string,
    transaction?: Transaction
  ): Promise<LessonCompletion> {
    const existingCompletion = await this.findByUserAndLesson(user_id, lesson_id, { transaction });

    if (existingCompletion) {
      // Update existing completion
      await this.updateById(
        existingCompletion.id,
        {
          completed_at: new Date(),
        },
        { transaction }
      );
      return existingCompletion;
    } else {
      // Create new completion
      return await this.create(
        {
          user_id,
          lesson_id,
          completed_at: new Date(),
        },
        { transaction }
      );
    }
  }

  /**
   * Update completion timestamp for a lesson
   */
  async updateCompletionTime(
    user_id: string,
    lesson_id: string,
    transaction?: Transaction
  ): Promise<LessonCompletion | null> {
    const completion = await this.findByUserAndLesson(user_id, lesson_id, { transaction });

    if (completion) {
      return await this.updateById(completion.id, { completed_at: new Date() }, { transaction });
    } else {
      // Create completion record
      return await this.create(
        {
          user_id,
          lesson_id,
          completed_at: new Date(),
        },
        { transaction }
      );
    }
  }

  /**
   * Get user's learning statistics
   */
  async getUserLearningStats(user_id: string): Promise<{
    totalCompletedLessons: number;
    coursesInProgress: number;
    coursesCompleted: number;
    averageProgressPercentage: number;
  }> {
    // Get total completed lessons count
    const completionStats = await LessonCompletion.findOne({
      attributes: [
        [
          LessonCompletion.sequelize!.fn('COUNT', LessonCompletion.sequelize!.col('id')),
          'totalCompleted',
        ],
      ],
      where: {
        user_id,
      },
      raw: true,
    });

    const totalCompletedLessons = parseInt((completionStats as any)?.totalCompleted || '0');

    // Get courses with progress
    const courseProgressQuery = `
      SELECT 
        s.course_id,
        COUNT(l.id) as total_lessons,
        COUNT(lc.id) as completed_lessons,
        ROUND((COUNT(lc.id) * 100.0 / COUNT(l.id)), 2) as progress_percentage
      FROM 
        sections s
      INNER JOIN 
        lessons l ON s.id = l.section_id
      LEFT JOIN 
        lesson_completions lc ON l.id = lc.lesson_id AND lc.user_id = :user_id AND lc.completed_at IS NOT NULL
      GROUP BY 
        s.course_id
      HAVING 
        COUNT(lc.id) > 0
    `;

    const courseProgress = (await LessonCompletion.sequelize!.query(courseProgressQuery, {
      replacements: { user_id },
      type: QueryTypes.SELECT,
    })) as any[];

    const coursesInProgress = courseProgress.filter(cp => cp.progress_percentage < 100).length;
    const coursesCompleted = courseProgress.filter(cp => cp.progress_percentage === 100).length;
    const averageProgressPercentage =
      courseProgress.length > 0
        ? Math.round(
            courseProgress.reduce((sum, cp) => sum + parseFloat(cp.progress_percentage), 0) /
              courseProgress.length
          )
        : 0;

    return {
      totalCompletedLessons,
      coursesInProgress,
      coursesCompleted,
      averageProgressPercentage,
    };
  }

  /**
   * Get completion rate by course
   */
  async getCompletionRateByCourse(course_id: string): Promise<{
    totalStudents: number;
    studentsWithProgress: number;
    studentsCompleted: number;
    averageCompletionRate: number;
  }> {
    // This would require joining with enrollments to get total enrolled students
    // For now, we'll get students who have started the course
    const query = `
      SELECT 
        COUNT(DISTINCT lc.user_id) as students_with_progress,
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(lc.id) as total_completions,
        ROUND((COUNT(lc.id) * 100.0 / (COUNT(DISTINCT lc.user_id) * COUNT(DISTINCT l.id))), 2) as avg_completion_rate
      FROM 
        sections s
      INNER JOIN 
        lessons l ON s.id = l.section_id
      LEFT JOIN 
        lesson_completions lc ON l.id = lc.lesson_id AND lc.completed_at IS NOT NULL
      WHERE 
        s.course_id = :course_id
    `;

    const result = (await LessonCompletion.sequelize!.query(query, {
      replacements: { course_id },
      type: QueryTypes.SELECT,
    })) as any[];

    const stats = result[0] || {};

    // Get students who completed 100% of the course
    const completedStudentsQuery = `
      SELECT COUNT(*) as completed_count
      FROM (
        SELECT 
          lc.user_id,
          COUNT(l.id) as total_lessons,
          COUNT(lc.id) as completed_lessons
        FROM 
          sections s
        INNER JOIN 
          lessons l ON s.id = l.section_id
        LEFT JOIN 
          lesson_completions lc ON l.id = lc.lesson_id AND lc.completed_at IS NOT NULL
        WHERE 
          s.course_id = :course_id
        GROUP BY 
          lc.user_id, s.course_id
        HAVING 
          COUNT(lc.id) = COUNT(l.id) AND COUNT(lc.id) > 0
      ) as completed_students
    `;

    const completedResult = (await LessonCompletion.sequelize!.query(completedStudentsQuery, {
      replacements: { course_id },
      type: QueryTypes.SELECT,
    })) as any[];

    return {
      totalStudents: parseInt(stats.students_with_progress || '0'),
      studentsWithProgress: parseInt(stats.students_with_progress || '0'),
      studentsCompleted: parseInt(completedResult[0]?.completed_count || '0'),
      averageCompletionRate: parseFloat(stats.avg_completion_rate || '0'),
    };
  }

  /**
   * Check if lesson is completed by user
   */
  async isLessonCompleted(user_id: string, lesson_id: string): Promise<boolean> {
    return await this.exists({
      user_id,
      lesson_id,
    });
  }

  /**
   * Get completion timeline for a user
   */
  async getCompletionTimeline(user_id: string, days: number = 30): Promise<any[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await LessonCompletion.findAll({
      attributes: [
        [
          LessonCompletion.sequelize!.fn('DATE', LessonCompletion.sequelize!.col('completed_at')),
          'completion_date',
        ],
        [
          LessonCompletion.sequelize!.fn('COUNT', LessonCompletion.sequelize!.col('id')),
          'lessons_completed',
        ],
      ],
      where: {
        user_id,
        completed_at: {
          [Op.gte]: startDate,
        },
      },
      group: [
        LessonCompletion.sequelize!.fn('DATE', LessonCompletion.sequelize!.col('completed_at')),
      ],
      order: [[LessonCompletion.sequelize!.literal('completion_date'), 'ASC']],
      raw: true,
    });
  }
}

export default new LessonCompletionRepository();
