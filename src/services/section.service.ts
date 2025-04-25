import Section from "../models/section.model";
import Course from "../models/course.model";
import User from "../models/user.model";
import { ApiError } from "../utils/api-error";
import sequelize from "../config/database";
import { Transaction, Op } from "sequelize";

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
      console.error("Error initializing section table:", error);
      throw new ApiError(500, "Failed to initialize section table");
    }
  }

  /**
   * Check if user is authorized to manage a course's sections
   * @param course_id - The ID of the course
   * @param user_id - The ID of the user
   * @returns True if authorized, throws error if not
   */
  private async checkCourseOwnership(
    course_id: string,
    user_id: string
  ): Promise<boolean> {
    const course = await Course.findByPk(course_id);

    if (!course) {
      throw new ApiError(404, "Course not found");
    }

    if (course.instructor_id !== user_id) {
      throw new ApiError(
        403,
        "You are not authorized to manage sections for this course"
      );
    }

    return true;
  }

  /**
   * Get the next order index for a new section in a course
   * This method considers both course_id and existing section IDs
   * @param course_id - The ID of the course
   * @param transaction - Optional transaction
   * @returns The next order index
   */
  private async getNextOrderIndex(
    course_id: string,
    transaction?: Transaction
  ): Promise<number> {
    const options = transaction ? { transaction } : {};

    // Get all sections for this course
    const sections = await Section.findAll({
      where: { course_id },
      order: [["order_index", "DESC"]],
      ...options,
    });

    if (sections.length === 0) {
      return 0; // First section in the course
    }

    // Find the highest order_index
    let maxOrderIndex = 0;
    for (const section of sections) {
      if (section.order_index > maxOrderIndex) {
        maxOrderIndex = section.order_index;
      }
    }

    return maxOrderIndex + 1;
  }

  /**
   * Create a new section
   */
  async createSection(
    data: SectionCreateData,
    user_id: string
  ): Promise<Section> {
    const { course_id, title, description } = data;
    let { order_index } = data;

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Check if user owns the course
      await this.checkCourseOwnership(course_id, user_id);

      // If order_index is not provided, get the next available index
      if (!order_index) {
        order_index = await this.getNextOrderIndex(course_id, transaction);
      }

      // Create the section
      const section = await Section.create(
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

      return section;
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a section by ID
   */
  async getSectionById(id: string): Promise<Section> {
    const section = await Section.findByPk(id, {
      include: [
        {
          model: Course,
          as: "course",
          attributes: ["id", "title", "instructor_id"],
          include: [
            {
              model: User,
              as: "instructor",
              attributes: ["id", "name", "email"],
            },
          ],
        },
      ],
    });

    if (!section) {
      throw new ApiError(404, "Section not found");
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
    const section = await this.getSectionById(section_id);
    const course = section.get("course") as any;

    // Admin always has access
    if (isAdmin) {
      return true;
    }

    // Check if user is the instructor of the course
    if (course.instructor_id === user_id) {
      return true;
    }

    // TODO: Check if user is enrolled in the course
    // This would be implemented when enrollment functionality is added

    throw new ApiError(403, "You do not have access to this section");
  }

  /**
   * Get all sections for a course
   */
  async getCourseSections(course_id: string): Promise<Section[]> {
    const sections = await Section.findAll({
      where: { course_id },
      order: [["order_index", "ASC"]],
      attributes: ["id", "course_id", "title", "description", "order_index"],
    });

    return sections;
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

    // Update the section
    await section.update({
      title: title ? title : section.title,
      description: description ? description : section.description,
      // order_index: order_index ? order_index : section.order_index,
    });

    return this.getSectionById(id);
  }

  /**
   * Delete a section
   */
  async deleteSection(
    id: string,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<void> {
    // Get the section
    const section = await this.getSectionById(id);

    // Check if user is authorized to delete the section
    if (!isAdmin) {
      await this.checkCourseOwnership(section.course_id, user_id);
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Get the order_index of the section to be deleted
      const deletedSectionOrderIndex = section.order_index;

      // Delete the section
      await section.destroy({ transaction });

      // TODO: Delete related lessons when Lesson model is implemented
      // await Lesson.destroy({
      //   where: { section_id: id },
      //   transaction,
      // });

      // Get all remaining sections in the same course with higher order_index
      const sectionsToUpdate = await Section.findAll({
        where: {
          course_id: section.course_id,
          order_index: { [Op.gt]: deletedSectionOrderIndex },
        },
        order: [["order_index", "ASC"]],
        transaction,
      });

      // Update the order_index of each remaining section
      for (const sectionToUpdate of sectionsToUpdate) {
        await sectionToUpdate.update(
          { order_index: sectionToUpdate.order_index - 1 },
          { transaction }
        );
      }

      // Commit the transaction
      await transaction.commit();
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
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

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Get all existing sections for this course
      const existingSections = await Section.findAll({
        where: { course_id },
        transaction,
      });

      // Create a map of section IDs to their current order_index
      const sectionMap = new Map<string, number>();
      existingSections.forEach((section) => {
        sectionMap.set(section.id, section.order_index);
      });

      // Validate that all sections in the request exist in the course
      for (const item of sections) {
        if (!sectionMap.has(item.id)) {
          throw new ApiError(
            404,
            `Section with ID ${item.id} not found in this course`
          );
        }
      }

      // Check for duplicate order_index values
      const orderIndices = sections.map((item) => item.order_index);
      const uniqueOrderIndices = new Set(orderIndices);
      if (orderIndices.length !== uniqueOrderIndices.size) {
        throw new ApiError(400, "Duplicate order_index values are not allowed");
      }

      // Update each section's order_index
      for (const item of sections) {
        const section = existingSections.find((s) => s.id === item.id);
        if (section) {
          await section.update(
            { order_index: item.order_index },
            { transaction }
          );
        }
      }

      // Commit the transaction
      await transaction.commit();
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }
}

export default new SectionService();
