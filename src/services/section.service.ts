import { Transaction } from 'sequelize';
import { sectionRepository, courseRepository, userRepository } from '../repositories';
import Section from '../models/section.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

interface SectionCreateData {
  course_id: string;
  title: string;
  description?: string;
  order_index?: number;
}

interface SectionUpdateData {
  title?: string;
  description?: string;
  order_index?: number;
}

interface SectionReorderItem {
  id: string;
  order_index: number;
}

class SectionService {
  /**
   * Initialize section table
   */
  async initSectionTable(): Promise<void> {
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS course_sections (
          id VARCHAR(20) PRIMARY KEY,
          course_id VARCHAR(20) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          order_index INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
          INDEX idx_course_order (course_id, order_index)
        );
      `);

      return;
    } catch (error) {
      console.error('Error initializing section table:', error);
      throw new ApiError(500, 'Failed to initialize section table');
    }
  }

  /**
   * Check if user is authorized to manage a course's sections
   * @param course_id - The ID of the course
   * @param user_id - The ID of the user
   * @returns True if authorized, throws error if not
   */
  private async checkCourseOwnership(course_id: string, user_id: string): Promise<boolean> {
    const course = await courseRepository.findById(course_id);

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    if (course.instructor_id !== user_id) {
      throw new ApiError(403, 'You are not authorized to manage sections for this course');
    }

    return true;
  }

  /**
   * Create a new section
   */
  async createSection(data: SectionCreateData, user_id: string): Promise<Section> {
    const { course_id, title, description } = data;
    let { order_index } = data;

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Check if user owns the course
      await this.checkCourseOwnership(course_id, user_id);

      // If order_index is not provided, get the next available index
      if (!order_index) {
        order_index = await sectionRepository.getNextOrderIndex(course_id);
      }

      // Create the section using repository
      const section = await sectionRepository.create(
        {
          course_id,
          title,
          description: description || null,
          order_index,
        },
        { transaction }
      );

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      return section;
    } catch (error) {
      // Rollback the transaction
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Get a section by ID
   */
  async getSectionById(id: string): Promise<Section> {
    const section = await sectionRepository.findByIdWithDetails(id);

    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    return section;
  }

  /**
   * Check if user has access to a section
   * @param section_id - The ID of the section
   * @param user_id - The ID of the user
   * @param isAdmin - Whether the user is an admin
   * @returns True if has access, throws error if not
   */
  async checkSectionAccess(
    section_id: string,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<boolean> {
    return await sectionRepository.canUserAccessSection(section_id, user_id);
  }

  /**
   * Get all sections for a course
   */
  async getCourseSections(course_id: string): Promise<Section[]> {
    return await sectionRepository.findByCourseId(course_id);
  }

  /**
   * Update a section
   */
  async updateSection(
    id: string,
    data: SectionUpdateData,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<Section> {
    const { title, description } = data;

    // Get the section
    const section = await this.getSectionById(id);

    // Check if user is authorized to update the section
    if (!isAdmin) {
      await this.checkCourseOwnership(section.course_id, user_id);
    }

    // Update the section using repository
    const updatedSection = await sectionRepository.updateById(id, {
      title: title !== undefined ? title : section.title,
      description: description !== undefined ? description : section.description,
    });

    if (!updatedSection) {
      throw new ApiError(404, 'Section not found');
    }

    return this.getSectionById(id);
  }

  /**
   * Delete a section
   */
  async deleteSection(id: string, user_id: string, isAdmin: boolean = false): Promise<void> {
    // Get the section
    const section = await this.getSectionById(id);

    // Check if user is authorized to delete the section
    if (!isAdmin) {
      await this.checkCourseOwnership(section.course_id, user_id);
    }

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Get the order_index of the section to be deleted
      const deletedSectionOrderIndex = section.order_index;

      // Delete the section using repository
      await sectionRepository.deleteById(id, { transaction });

      // TODO: Delete related lessons when Lesson model is implemented
      // This would be handled by the cascade delete in the database

      // Reorder sections after deletion
      await sectionRepository.reorderSections(
        section.course_id,
        deletedSectionOrderIndex,
        transaction
      );

      // Commit the transaction
      await transaction.commit();
      transaction = null;
    } catch (error) {
      // Rollback the transaction
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Reorder sections in a course
   */
  async reorderSections(
    course_id: string,
    sections: SectionReorderItem[],
    user_id: string,
    isAdmin: boolean = false
  ): Promise<void> {
    // Check if user is authorized to reorder sections
    if (!isAdmin) {
      await this.checkCourseOwnership(course_id, user_id);
    }

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Get all existing sections for this course using repository
      const existingSections = await sectionRepository.findByCourseId(course_id, { transaction });

      // Create a map of section IDs to their current order_index
      const sectionMap = new Map<string, number>();
      existingSections.forEach(section => {
        sectionMap.set(section.id, section.order_index);
      });

      // Validate that all sections in the request exist in the course
      for (const item of sections) {
        if (!sectionMap.has(item.id)) {
          throw new ApiError(404, `Section with ID ${item.id} not found in this course`);
        }
      }

      // Check for duplicate order_index values
      const orderIndices = sections.map(item => item.order_index);
      const uniqueOrderIndices = new Set(orderIndices);
      if (orderIndices.length !== uniqueOrderIndices.size) {
        throw new ApiError(400, 'Duplicate order_index values are not allowed');
      }

      // Update each section's order_index using repository
      for (const item of sections) {
        await sectionRepository.updateOrder(item.id, item.order_index, transaction);
      }

      // Commit the transaction
      await transaction.commit();
      transaction = null;
    } catch (error) {
      // Rollback the transaction
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }
}

export default new SectionService();
