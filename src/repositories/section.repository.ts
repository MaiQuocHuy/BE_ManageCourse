import { Op, FindOptions, Transaction } from 'sequelize';
import Section from '../models/section.model';
import Lesson from '../models/lesson.model';
import Course from '../models/course.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export class SectionRepository extends BaseRepository<Section> {
  constructor() {
    super(Section);
  }

  /**
   * Find sections by course ID with lessons
   */
  async findByCourseId(course_id: string, options?: FindOptions): Promise<Section[]> {
    return await this.findAll({
      where: { course_id },
      include: [
        {
          model: Lesson,
          as: 'lessons',
          attributes: ['id', 'title', 'duration', 'order_index', 'video_url', 'is_preview'],
        },
      ],
      order: [
        ['order_index', 'ASC'],
        [{ model: Lesson, as: 'lessons' }, 'order_index', 'ASC'],
      ],
      ...options,
    });
  }

  /**
   * Find section with lessons and course details
   */
  async findByIdWithDetails(id: string, options?: FindOptions): Promise<Section | null> {
    return await this.findById(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'instructor_id'],
        },
        {
          model: Lesson,
          as: 'lessons',
          attributes: [
            'id',
            'title',
            'description',
            'duration',
            'order_index',
            'video_url',
            'is_preview',
          ],
          order: [['order_index', 'ASC']],
        },
      ],
      ...options,
    });
  }

  /**
   * Find sections by instructor ID
   */
  async findByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ sections: Section[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          where: { instructor_id },
          attributes: ['id', 'title'],
        },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return {
      sections: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Update section order
   */
  async updateOrder(
    id: string,
    order_index: number,
    transaction?: Transaction
  ): Promise<Section | null> {
    return await this.updateById(id, { order_index }, { transaction });
  }

  /**
   * Get section count for a course
   */
  async getSectionCountByCourse(course_id: string): Promise<number> {
    return await this.count({ where: { course_id } });
  }

  /**
   * Get next order index for a course
   */
  async getNextOrderIndex(course_id: string): Promise<number> {
    const maxOrderSection = await this.findOne({
      where: { course_id },
      attributes: ['order_index'],
      order: [['order_index', 'DESC']],
    });

    return maxOrderSection ? maxOrderSection.order_index + 1 : 1;
  }

  /**
   * Reorder sections after deletion
   */
  async reorderSections(
    course_id: string,
    deletedOrderIndex: number,
    transaction?: Transaction
  ): Promise<void> {
    await Section.update(
      { order_index: Section.sequelize!.literal('order_index - 1') },
      {
        where: {
          course_id,
          order_index: { [Op.gt]: deletedOrderIndex },
        },
        transaction,
      }
    );
  }

  /**
   * Move section up/down
   */
  async moveSectionOrder(
    id: string,
    direction: 'up' | 'down',
    transaction?: Transaction
  ): Promise<boolean> {
    const section = await this.findById(id, { transaction });
    if (!section) return false;

    const currentOrder = section.order_index;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    // Find the section to swap with
    const targetSection = await this.findOne({
      where: {
        course_id: section.course_id,
        order_index: targetOrder,
      },
      transaction,
    });

    if (!targetSection) return false;

    // Swap order indexes
    await this.updateById(section.id, { order_index: targetOrder }, { transaction });
    await this.updateById(targetSection.id, { order_index: currentOrder }, { transaction });

    return true;
  }

  /**
   * Get course sections with lesson count
   */
  async findWithLessonCount(course_id: string): Promise<any[]> {
    return await this.findAll({
      where: { course_id },
      include: [
        {
          model: Lesson,
          as: 'lessons',
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [Section.sequelize!.fn('COUNT', Section.sequelize!.col('lessons.id')), 'lesson_count'],
        ],
      },
      group: ['Section.id'],
      order: [['order_index', 'ASC']],
    });
  }

  /**
   * Check if user can access section (via course enrollment)
   */
  async canUserAccessSection(section_id: string, user_id: string): Promise<boolean> {
    const section = await this.findOne({
      where: { id: section_id },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['instructor_id'],
          include: [
            {
              model: 'Enrollment' as any,
              as: 'enrollments',
              where: { user_id },
              required: false,
            },
          ],
        },
      ],
    });

    if (!section) return false;

    const course = section.get('course') as any;

    // Check if user is instructor
    if (course.instructor_id === user_id) return true;

    // Check if user is enrolled
    const enrollments = course.get('enrollments');
    return enrollments && enrollments.length > 0;
  }
}

export default new SectionRepository();
