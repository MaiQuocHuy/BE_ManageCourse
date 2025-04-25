import Lesson, { LessonType } from "../models/lesson.model";
import LessonCompletion from "../models/lesson-completion.model";
import Section from "../models/section.model";
import Course from "../models/course.model";
import { ApiError } from "../utils/api-error";
import sequelize from "../config/database";
import { Transaction, Op } from "sequelize";

/**
 * Interface for metadata structure
 * Used to store additional information about the lesson content
 */
export interface LessonMetadata {
  public_id?: string; // Cloudinary public ID for video
  thumbnail_url?: string; // URL to video thumbnail
  resource_type?: string; // Type of resource (video, image, etc.)
  format?: string; // File format (mp4, mov, etc.)
  secure_url?: string; // Secure URL (if different from content URL)
  created_at?: string; // When the resource was created
  tags?: string[]; // Optional tags for the content
  [key: string]: any; // Allow for additional properties
}

export interface LessonCreateData {
  section_id: string;
  title: string;
  type: LessonType;
  content?: string;
  duration?: number;
  is_free?: boolean;
  metadata?: LessonMetadata | string; // Can accept object or JSON string
}

export interface LessonUpdateData {
  title?: string;
  type?: LessonType;
  content?: string;
  duration?: number;
  is_free?: boolean;
  metadata?: LessonMetadata | string; // Can accept object or JSON string
}

interface LessonReorderItem {
  id: string;
  order_index: number;
}

class LessonService {
  /**
   * Check if user is authorized to manage a section's lessons
   * @param section_id - The ID of the section
   * @param user_id - The ID of the user
   * @returns True if authorized, throws error if not
   */
  private async checkSectionOwnership(
    section_id: string,
    user_id: string
  ): Promise<boolean> {
    const section = await Section.findByPk(section_id, {
      include: [
        {
          model: Course,
          as: "course",
          attributes: ["id", "instructor_id"],
        },
      ],
    });

    if (!section) {
      throw new ApiError(404, "Section not found");
    }

    const course = section.get("course") as any;
    if (course.instructor_id !== user_id) {
      throw new ApiError(
        403,
        "You are not authorized to manage lessons for this section"
      );
    }

    return true;
  }

  /**
   * Get the next order index for a new lesson in a section
   * @param section_id - The ID of the section
   * @param transaction - Optional transaction
   * @returns The next order index
   */
  private async getNextOrderIndex(
    section_id: string,
    transaction?: Transaction
  ): Promise<number> {
    const options = transaction ? { transaction } : {};

    // Get all lessons for this section
    const lessons = await Lesson.findAll({
      where: { section_id },
      order: [["order_index", "ASC"]],
      ...options,
    });

    if (lessons.length === 0) {
      return 0; // First lesson in the section
    }

    // Check if there are any gaps in the sequence
    for (let i = 0; i < lessons.length; i++) {
      if (lessons[i].order_index !== i) {
        return i; // Found a gap, use this index
      }
    }

    // No gaps found, use the next index in sequence
    return lessons.length;
  }

  /**
   * Create a new lesson
   */
  async createLesson(data: LessonCreateData, user_id: string): Promise<Lesson> {
    const { section_id, title, type, content, duration, is_free, metadata } =
      data;

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Check if user owns the section
      await this.checkSectionOwnership(section_id, user_id);

      // Always get the next available index
      const order_index = await this.getNextOrderIndex(section_id, transaction);

      console.log(
        `Creating lesson with auto-generated order_index: ${order_index}`
      );

      // Process metadata - ensure it's stored as a JSON string
      let metadataString: string | null = null;

      if (metadata) {
        if (typeof metadata === "string") {
          try {
            // Validate that the string is valid JSON
            JSON.parse(metadata);
            metadataString = metadata;
          } catch (e) {
            console.error("Invalid metadata JSON string:", e);
            throw new ApiError(
              400,
              "Invalid metadata format: must be valid JSON"
            );
          }
        } else {
          // Convert object to JSON string
          metadataString = JSON.stringify(metadata);
        }
      }

      // Create the lesson
      const lesson = await Lesson.create(
        {
          section_id,
          title,
          type,
          content: content || null,
          duration: duration || null,
          order_index,
          is_free: is_free !== undefined ? is_free : false,
          metadata: metadataString,
        },
        { transaction }
      );

      // Commit the transaction
      await transaction.commit();

      return this.getLessonById(lesson.id);
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a lesson by ID
   */
  async getLessonById(id: string): Promise<Lesson> {
    const lesson = await Lesson.findByPk(id, {
      include: [
        {
          model: Section,
          as: "section",
          attributes: ["id", "title", "course_id"],
          include: [
            {
              model: Course,
              as: "course",
              attributes: ["id", "title", "instructor_id"],
            },
          ],
        },
      ],
    });

    if (!lesson) {
      throw new ApiError(404, "Lesson not found");
    }

    // Parse metadata if it exists
    if (lesson.metadata) {
      try {
        // Add parsed metadata to the lesson instance
        (lesson as any).parsedMetadata = JSON.parse(lesson.metadata);
      } catch (e) {
        console.error(`Error parsing metadata for lesson ${id}:`, e);
        // Don't throw an error, just log it
      }
    }

    return lesson;
  }

  /**
   * Check if user has access to a lesson
   * @param lesson_id - The ID of the lesson
   * @param user_id - The ID of the user
   * @param isAdmin - Whether the user is an admin
   * @returns True if has access, throws error if not
   */
  async checkLessonAccess(
    lesson_id: string,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<boolean> {
    const lesson = await this.getLessonById(lesson_id);

    // If lesson is free, everyone has access
    if (lesson.is_free) {
      return true;
    }

    const section = lesson.get("section") as any;
    const course = section.course;

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

    throw new ApiError(403, "You do not have access to this lesson");
  }

  /**
   * Get all lessons for a section
   */
  async getLessonsBySection(section_id: string): Promise<Lesson[]> {
    const lessons = await Lesson.findAll({
      where: { section_id },
      order: [["order_index", "ASC"]],
      attributes: [
        "id",
        "section_id",
        "title",
        "type",
        "content",
        "duration",
        "order_index",
        "is_free",
        "metadata",
      ],
    });

    // Parse metadata for each lesson
    for (const lesson of lessons) {
      if (lesson.metadata) {
        try {
          // Add parsed metadata to the lesson instance
          (lesson as any).parsedMetadata = JSON.parse(lesson.metadata);
        } catch (e) {
          console.error(`Error parsing metadata for lesson ${lesson.id}:`, e);
          // Don't throw an error, just log it
        }
      }
    }

    return lessons;
  }

  /**
   * Update a lesson
   */
  async updateLesson(
    id: string,
    data: LessonUpdateData,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<Lesson> {
    const { title, type, content, duration, is_free, metadata } = data;

    // Get the lesson
    const lesson = await this.getLessonById(id);

    // Check if user is authorized to update the lesson
    if (!isAdmin) {
      const section = lesson.get("section") as any;
      await this.checkSectionOwnership(section.id, user_id);
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Update the lesson with only the provided fields
      const updateData: any = {};

      if (title !== undefined) updateData.title = title;
      if (type !== undefined) updateData.type = type;
      if (content !== undefined) updateData.content = content;
      if (duration !== undefined) updateData.duration = duration;
      if (is_free !== undefined) updateData.is_free = is_free;

      // Process metadata if provided
      if (metadata !== undefined) {
        if (typeof metadata === "string") {
          try {
            // Validate that the string is valid JSON
            JSON.parse(metadata);
            updateData.metadata = metadata;
          } catch (e) {
            console.error("Invalid metadata JSON string:", e);
            throw new ApiError(
              400,
              "Invalid metadata format: must be valid JSON"
            );
          }
        } else if (metadata === null) {
          // Allow clearing metadata
          updateData.metadata = null;
        } else {
          // Convert object to JSON string
          updateData.metadata = JSON.stringify(metadata);
        }

        console.log(`Updating lesson metadata: ${updateData.metadata}`);
      }

      // Update the lesson
      await lesson.update(updateData, { transaction });

      // Commit the transaction
      await transaction.commit();

      return this.getLessonById(id);
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(
    id: string,
    user_id: string,
    isAdmin: boolean = false
  ): Promise<void> {
    // Get the lesson
    const lesson = await this.getLessonById(id);

    // Check if user is authorized to delete the lesson
    if (!isAdmin) {
      const section = lesson.get("section") as any;
      await this.checkSectionOwnership(section.id, user_id);
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Get the order_index of the lesson to be deleted
      const deletedLessonOrderIndex = lesson.order_index;
      const section_id = lesson.section_id;

      console.log(
        `Deleting lesson with order_index: ${deletedLessonOrderIndex}`
      );

      // Check if there's metadata with Cloudinary resources to clean up
      if (lesson.metadata) {
        try {
          const metadata = JSON.parse(lesson.metadata);
          if (metadata.public_id) {
            console.log(
              `Found Cloudinary public_id in metadata: ${metadata.public_id}`
            );
            // Note: You would typically delete the resource from Cloudinary here
            // Example: await cloudinaryService.deleteResource(metadata.public_id, 'video');
            console.log(
              `Resource cleanup for ${metadata.public_id} should be handled here`
            );
          }
        } catch (e) {
          console.error(`Error parsing metadata for lesson ${id}:`, e);
          // Continue with deletion even if metadata parsing fails
        }
      }

      // Delete the lesson
      await lesson.destroy({ transaction });

      // Get all remaining lessons in the same section
      const remainingLessons = await Lesson.findAll({
        where: { section_id },
        order: [["order_index", "ASC"]],
        transaction,
      });

      // Reindex all lessons to ensure they are sequential from 0
      for (let i = 0; i < remainingLessons.length; i++) {
        const lessonToUpdate = remainingLessons[i];

        // Only update if the order_index has changed
        if (lessonToUpdate.order_index !== i) {
          console.log(
            `Updating lesson ${lessonToUpdate.id} order_index from ${lessonToUpdate.order_index} to ${i}`
          );
          await lessonToUpdate.update({ order_index: i }, { transaction });
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

  /**
   * Reorder lessons in a section
   */
  async reorderLessons(
    section_id: string,
    lessons: LessonReorderItem[],
    user_id: string,
    isAdmin: boolean = false
  ): Promise<void> {
    // Check if user is authorized to reorder lessons
    if (!isAdmin) {
      await this.checkSectionOwnership(section_id, user_id);
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Get all existing lessons for this section
      const existingLessons = await Lesson.findAll({
        where: { section_id },
        transaction,
      });

      // Create a map of lesson IDs
      const lessonMap = new Map<string, Lesson>();
      existingLessons.forEach((lesson) => {
        lessonMap.set(lesson.id, lesson);
      });

      // Validate that all lessons in the request exist in the section
      for (const item of lessons) {
        if (!lessonMap.has(item.id)) {
          throw new ApiError(
            404,
            `Lesson with ID ${item.id} not found in this section`
          );
        }
      }

      // Sort lessons by the provided order
      const sortedLessonIds = lessons.map((item) => item.id);

      // Update each lesson's order_index based on its position in the sorted array
      for (let i = 0; i < sortedLessonIds.length; i++) {
        const lessonId = sortedLessonIds[i];
        const lesson = lessonMap.get(lessonId);

        if (lesson) {
          // Only update if the order_index has changed
          if (lesson.order_index !== i) {
            console.log(
              `Updating lesson ${lessonId} order_index from ${lesson.order_index} to ${i}`
            );
            await lesson.update({ order_index: i }, { transaction });
          }
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

  /**
   * Mark a lesson as completed for a user
   */
  async markLessonCompleted(lesson_id: string, user_id: string): Promise<void> {
    // Check if the lesson exists
    await this.getLessonById(lesson_id);

    // Check if the completion already exists
    const existingCompletion = await LessonCompletion.findOne({
      where: {
        lesson_id,
        user_id,
      },
    });

    if (existingCompletion) {
      // Already marked as completed, nothing to do
      return;
    }

    // Create the completion record
    await LessonCompletion.create({
      lesson_id,
      user_id,
    });
  }

  /**
   * Check if a lesson is completed by a user
   */
  async isLessonCompleted(
    lesson_id: string,
    user_id: string
  ): Promise<boolean> {
    const completion = await LessonCompletion.findOne({
      where: {
        lesson_id,
        user_id,
      },
    });

    return !!completion;
  }

  /**
   * Get all completed lessons for a user in a course
   */
  async getCompletedLessons(
    course_id: string,
    user_id: string
  ): Promise<Lesson[]> {
    // Get all sections in the course
    const sections = await Section.findAll({
      where: { course_id },
      attributes: ["id"],
    });

    const sectionIds = sections.map((section) => section.id);

    if (sectionIds.length === 0) {
      return [];
    }

    // Get all completed lessons
    const completedLessons = await Lesson.findAll({
      include: [
        {
          model: LessonCompletion,
          as: "completions",
          where: { user_id },
          attributes: ["completed_at"],
        },
        {
          model: Section,
          as: "section",
          where: { id: { [Op.in]: sectionIds } },
          attributes: ["id", "title", "course_id"],
        },
      ],
      order: [
        [{ model: Section, as: "section" }, "order_index", "ASC"],
        ["order_index", "ASC"],
      ],
    });

    return completedLessons;
  }

  /**
   * Calculate the completion percentage of a course for a user
   */
  async getCourseCompletionPercentage(
    course_id: string,
    user_id: string
  ): Promise<number> {
    // Get all sections in the course
    const sections = await Section.findAll({
      where: { course_id },
      attributes: ["id"],
    });

    const sectionIds = sections.map((section) => section.id);

    if (sectionIds.length === 0) {
      return 0;
    }

    // Count total lessons in the course
    const totalLessons = await Lesson.count({
      where: {
        section_id: { [Op.in]: sectionIds },
      },
    });

    if (totalLessons === 0) {
      return 0;
    }

    // Count completed lessons
    const completedLessonsCount = await Lesson.count({
      include: [
        {
          model: LessonCompletion,
          as: "completions",
          where: { user_id },
          attributes: [],
        },
      ],
      where: {
        section_id: { [Op.in]: sectionIds },
      },
    });

    // Calculate percentage
    return Math.round((completedLessonsCount / totalLessons) * 100);
  }

  /**
   * Get the next uncompleted lesson for a user in a course
   */
  async getNextLesson(
    course_id: string,
    user_id: string
  ): Promise<Lesson | null> {
    // Get all sections in the course
    const sections = await Section.findAll({
      where: { course_id },
      order: [["order_index", "ASC"]],
      attributes: ["id"],
    });

    const sectionIds = sections.map((section) => section.id);

    if (sectionIds.length === 0) {
      return null;
    }

    // Get all lesson IDs that the user has completed
    const completions = await LessonCompletion.findAll({
      where: { user_id },
      attributes: ["lesson_id"],
    });

    const completedLessonIds = completions.map(
      (completion) => completion.lesson_id
    );

    // Find the first lesson that hasn't been completed
    const nextLesson = await Lesson.findOne({
      where: {
        section_id: { [Op.in]: sectionIds },
        ...(completedLessonIds.length > 0 && {
          id: { [Op.notIn]: completedLessonIds },
        }),
      },
      include: [
        {
          model: Section,
          as: "section",
          attributes: ["id", "title", "course_id", "order_index"],
        },
      ],
      order: [
        [{ model: Section, as: "section" }, "order_index", "ASC"],
        ["order_index", "ASC"],
      ],
    });

    return nextLesson;
  }
}

export default new LessonService();
