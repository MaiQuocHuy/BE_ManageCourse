import { Op, FindOptions, Transaction } from 'sequelize';
import CourseCategory from '../models/course-category.model';
import { BaseRepository } from './base.repository';

export class CourseCategoryRepository extends BaseRepository<CourseCategory> {
  constructor() {
    super(CourseCategory);
  }

  /**
   * Associate a course with a category
   */
  async associateCourseWithCategory(
    course_id: string,
    category_id: string
  ): Promise<CourseCategory> {
    return await CourseCategory.upsert({
      course_id,
      category_id,
    }).then(([record]) => record);
  }

  /**
   * Remove a course-category association
   */
  async disassociateCourseFromCategory(course_id: string, category_id: string): Promise<number> {
    return await CourseCategory.destroy({
      where: { course_id, category_id },
    });
  }

  /**
   * Get all category IDs for a course
   */
  async getCategoryIdsForCourse(course_id: string): Promise<string[]> {
    const records = await CourseCategory.findAll({
      where: { course_id },
      attributes: ['category_id'],
    });

    return records.map(record => record.category_id);
  }

  /**
   * Get all course IDs for a category
   */
  async getCourseIdsForCategory(category_id: string): Promise<string[]> {
    const records = await CourseCategory.findAll({
      where: { category_id },
      attributes: ['course_id'],
    });

    return records.map(record => record.course_id);
  }

  /**
   * Check if a course-category association exists
   */
  async associationExists(course_id: string, category_id: string): Promise<boolean> {
    return await this.exists({ course_id, category_id });
  }

  /**
   * Get all course-category associations for a course
   */
  async getAssociationsForCourse(course_id: string): Promise<CourseCategory[]> {
    return await this.findAll({
      where: { course_id },
    });
  }

  /**
   * Get all course-category associations for a category
   */
  async getAssociationsForCategory(category_id: string): Promise<CourseCategory[]> {
    return await this.findAll({
      where: { category_id },
    });
  }
}

export default new CourseCategoryRepository();
