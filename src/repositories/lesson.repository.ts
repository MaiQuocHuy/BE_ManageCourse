import { Op, FindOptions, Transaction } from 'sequelize';
import Lesson from '../models/lesson.model';
import Section from '../models/section.model';
import Course from '../models/course.model';
import LessonCompletion from '../models/lesson-completion.model';
import User from '../models/user.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class LessonRepository extends BaseRepository<Lesson> {
  constructor() {
    super(Lesson);
  }

  /**
   * Find lessons by section ID
   */
  async findBySectionId(
    section_id: string,
    options: PaginationOptions = {}
  ): Promise<{ lessons: Lesson[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = { section_id };

    if (search) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['order_index', 'ASC']],
    });

    return {
      lessons: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find lessons by course ID
   */
  async findByCourseId(
    course_id: string,
    options: PaginationOptions = {}
  ): Promise<{ lessons: Lesson[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (search) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Section,
          as: 'section',
          where: { course_id },
          attributes: ['id', 'title'],
        },
      ],
      limit,
      offset,
      order: [
        [{ model: Section, as: 'section' }, 'order_index', 'ASC'],
        ['order_index', 'ASC'],
      ],
    });

    return {
      lessons: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find lesson with section and course details
   */
  async findWithDetails(id: string): Promise<Lesson | null> {
    return await this.findById(id, {
      include: [
        {
          model: Section,
          as: 'section',
          attributes: ['id', 'title', 'course_id'],
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'instructor_id'],
            },
          ],
        },
      ],
    });
  }

  /**
   * Get next lesson in the same section
   */
  async getNextLesson(section_id: string, current_order: number): Promise<Lesson | null> {
    return await this.findOne({
      where: {
        section_id,
        order_index: { [Op.gt]: current_order },
      },
      order: [['order_index', 'ASC']],
    });
  }

  /**
   * Get previous lesson in the same section
   */
  async getPreviousLesson(section_id: string, current_order: number): Promise<Lesson | null> {
    return await this.findOne({
      where: {
        section_id,
        order_index: { [Op.lt]: current_order },
      },
      order: [['order_index', 'DESC']],
    });
  }

  /**
   * Get next order index for a section
   */
  async getNextOrderIndex(section_id: string): Promise<number> {
    const maxOrderLesson = await this.findOne({
      where: { section_id },
      attributes: ['order_index'],
      order: [['order_index', 'DESC']],
    });

    return maxOrderLesson ? maxOrderLesson.order_index + 1 : 1;
  }

  /**
   * Update lesson order
   */
  async updateOrder(
    id: string,
    order_index: number,
    transaction?: Transaction
  ): Promise<Lesson | null> {
    return await this.updateById(id, { order_index }, { transaction });
  }

  /**
   * Move lesson up/down in section
   */
  async moveLessonOrder(
    id: string,
    direction: 'up' | 'down',
    transaction?: Transaction
  ): Promise<boolean> {
    const lesson = await this.findById(id, { transaction });
    if (!lesson) return false;

    const currentOrder = lesson.order_index;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    // Find the lesson to swap with (same section)
    const targetLesson = await this.findOne({
      where: {
        section_id: lesson.section_id,
        order_index: targetOrder,
      },
      transaction,
    });

    if (!targetLesson) return false;

    // Swap order indexes
    await this.updateById(lesson.id, { order_index: targetOrder }, { transaction });
    await this.updateById(targetLesson.id, { order_index: currentOrder }, { transaction });

    return true;
  }

  /**
   * Reorder lessons after deletion
   */
  async reorderLessons(
    section_id: string,
    deletedOrderIndex: number,
    transaction?: Transaction
  ): Promise<void> {
    await Lesson.update(
      { order_index: Lesson.sequelize!.literal('order_index - 1') },
      {
        where: {
          section_id,
          order_index: { [Op.gt]: deletedOrderIndex },
        },
        transaction,
      }
    );
  }

  /**
   * Find lessons with completion status for user
   */
  async findWithCompletionStatus(course_id: string, user_id: string): Promise<any[]> {
    return await this.findAll({
      include: [
        {
          model: Section,
          as: 'section',
          where: { course_id },
          attributes: ['id', 'title', 'order_index'],
        },
        {
          model: LessonCompletion,
          as: 'completions',
          where: { user_id },
          required: false,
          attributes: ['id', 'completed_at'],
        },
      ],
      order: [
        [{ model: Section, as: 'section' }, 'order_index', 'ASC'],
        ['order_index', 'ASC'],
      ],
    });
  }

  /**
   * Count lessons by type
   */
  async countByType(section_id?: string): Promise<{ [key: string]: number }> {
    let whereClause: any = {};

    if (section_id) {
      whereClause.section_id = section_id;
    }

    const lessons = await this.findAll({
      where: whereClause,
      attributes: ['type'],
    });

    const counts: { [key: string]: number } = {};
    lessons.forEach(lesson => {
      counts[lesson.type] = (counts[lesson.type] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get lesson statistics
   */
  async getLessonStats(course_id?: string): Promise<{
    totalLessons: number;
    totalDuration: number;
  }> {
    let whereClause: any = {};

    if (course_id) {
      whereClause = {
        include: [
          {
            model: Section,
            as: 'section',
            where: { course_id },
            attributes: [],
          },
        ],
      };
    }

    const lessons = await this.findAll({
      where: course_id ? {} : undefined,
      attributes: ['id', 'duration'],
      ...(course_id ? whereClause : {}),
    });

    const stats = lessons.reduce(
      (acc, lesson) => {
        acc.totalLessons++;
        if (lesson.duration) acc.totalDuration += lesson.duration;
        return acc;
      },
      { totalLessons: 0, totalDuration: 0 }
    );

    return stats;
  }

  /**
   * Search lessons across all courses
   */
  async searchLessons(
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<{ lessons: Lesson[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await this.findAndCountAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${searchTerm}%` } },
          { content: { [Op.like]: `%${searchTerm}%` } },
        ],
      },
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
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      lessons: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find lessons by instructor
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ lessons: Lesson[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (search) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Section,
          as: 'section',
          attributes: ['id', 'title'],
          include: [
            {
              model: Course,
              as: 'course',
              where: { instructor_id },
              attributes: ['id', 'title'],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [
        [{ model: Section, as: 'section' }, { model: Course, as: 'course' }, 'title', 'ASC'],
        [{ model: Section, as: 'section' }, 'order_index', 'ASC'],
        ['order_index', 'ASC'],
      ],
    });

    return {
      lessons: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Get lessons ordered by section
   */
  async getLessonsOrderedBySection(section_id: string): Promise<Lesson[]> {
    return await this.findAll({
      where: { section_id },
      order: [['order_index', 'ASC']],
    });
  }
}

export default new LessonRepository();
