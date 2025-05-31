import { Transaction } from 'sequelize';
import {
  lessonRepository,
  sectionRepository,
  courseRepository,
  lessonCompletionRepository,
} from '../repositories';
import Lesson, { LessonType } from '../models/lesson.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

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
  metadata?: LessonMetadata | string; // Can accept object or JSON string
}

export interface LessonUpdateData {
  title?: string;
  type?: LessonType;
  content?: string;
  duration?: number;
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
  private async checkSectionOwnership(section_id: string, user_id: string): Promise<boolean> {
    const section = await sectionRepository.findByIdWithDetails(section_id);

    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    const course = section.get('course') as any;
    console.warn('course', course.instructor_id, user_id);
    if (course.instructor_id !== user_id) {
      throw new ApiError(403, 'You are not authorized to manage lessons for this section');
    }

    return true;
  }

  /**
   * Create a new lesson
   */
  async createLesson(data: LessonCreateData, user_id: string): Promise<Lesson> {
    const { section_id, title, type, content, duration, metadata } = data;

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Check if user owns the section
      await this.checkSectionOwnership(section_id, user_id);

      // Get the next order index
      const order_index = await lessonRepository.getNextOrderIndex(section_id);

      console.log(`Creating lesson with auto-generated order_index: ${order_index}`);

      // Process metadata - ensure it's stored as a JSON string
      let metadataString: string | null = null;

      if (metadata) {
        if (typeof metadata === 'string') {
          try {
            // Validate that the string is valid JSON
            JSON.parse(metadata);
            metadataString = metadata;
          } catch (e) {
            console.error('Invalid metadata JSON string:', e);
            throw new ApiError(400, 'Invalid metadata format: must be valid JSON');
          }
        } else {
          // Convert object to JSON string
          metadataString = JSON.stringify(metadata);
        }
      }

      // Create the lesson using repository
      const lesson = await lessonRepository.create(
        {
          section_id,
          title,
          type,
          content: content || null,
          duration: duration || null,
          order_index,
          metadata: metadataString,
        },
        { transaction }
      );

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      return this.getLessonById(lesson.id);
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
   * Get a lesson by ID
   */
  async getLessonById(id: string): Promise<Lesson> {
    const lesson = await lessonRepository.findWithDetails(id);

    if (!lesson) {
      throw new ApiError(404, 'Lesson not found');
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
   * @returns True if has access, throws error if not
   */
  async checkLessonAccess(lesson_id: string, user_id: string): Promise<boolean> {
    // For now, return true - implement access logic as needed
    // TODO: Implement access logic as needed
    const lesson = await lessonRepository.findWithDetails(lesson_id);
    if (!lesson) {
      throw new ApiError(404, 'Lesson not found');
    }
    const section = lesson.get('section') as any;
    const course = section.get('course') as any;
    if (course.instructor_id !== user_id) {
      throw new ApiError(403, 'You are not authorized to access this lesson');
    }
    return true;
  }

  /**
   * Get all lessons for a section
   */
  async getLessonsBySection(section_id: string): Promise<Lesson[]> {
    const result = await lessonRepository.findBySectionId(section_id);
    const lessons = result.lessons;

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
  async updateLesson(id: string, data: LessonUpdateData, user_id: string): Promise<Lesson> {
    const { title, type, content, duration, metadata } = data;

    // Get the lesson
    const lesson = await this.getLessonById(id);

    // Check if user is authorized to update the lesson
    const section = lesson.get('section') as any;
    await this.checkSectionOwnership(section.id, user_id);

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Update the lesson with only the provided fields
      const updateData: any = {};

      if (title !== undefined) updateData.title = title;
      if (type !== undefined) updateData.type = type;
      if (content !== undefined) updateData.content = content;
      if (duration !== undefined) updateData.duration = duration;

      // Process metadata if provided
      if (metadata !== undefined) {
        if (typeof metadata === 'string') {
          try {
            // Validate that the string is valid JSON
            JSON.parse(metadata);
            updateData.metadata = metadata;
          } catch (e) {
            console.error('Invalid metadata JSON string:', e);
            throw new ApiError(400, 'Invalid metadata format: must be valid JSON');
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

      // Update the lesson using repository
      await lessonRepository.updateById(id, updateData, { transaction });

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      return this.getLessonById(id);
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
   * Delete a lesson
   */
  async deleteLesson(id: string, user_id: string, isAdmin: boolean = false): Promise<void> {
    // Get the lesson
    const lesson = await this.getLessonById(id);

    // Check if user is authorized to delete the lesson
    if (!isAdmin) {
      const section = lesson.get('section') as any;
      await this.checkSectionOwnership(section.id, user_id);
    }

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Get the order_index of the lesson to be deleted
      const deletedLessonOrderIndex = lesson.order_index;
      const section_id = lesson.section_id;

      console.log(`Deleting lesson with order_index: ${deletedLessonOrderIndex}`);

      // Check if there's metadata with Cloudinary resources to clean up
      if (lesson.metadata) {
        try {
          const metadata = JSON.parse(lesson.metadata);
          if (metadata.public_id) {
            console.log(`Found Cloudinary public_id in metadata: ${metadata.public_id}`);
            // Note: You would typically delete the resource from Cloudinary here
            // Example: await cloudinaryService.deleteResource(metadata.public_id, 'video');
            console.log(`Resource cleanup for ${metadata.public_id} should be handled here`);
          }
        } catch (e) {
          console.error(`Error parsing metadata for lesson ${id}:`, e);
          // Continue with deletion even if metadata parsing fails
        }
      }

      // Delete the lesson using repository
      await lessonRepository.deleteById(id, { transaction });

      // Reorder lessons after deletion
      await lessonRepository.reorderLessons(section_id, deletedLessonOrderIndex, transaction);

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

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Get all existing lessons for this section
      const result = await lessonRepository.findBySectionId(section_id);
      const existingLessons = result.lessons;

      // Create a map of lesson IDs
      const lessonMap = new Map<string, Lesson>();
      existingLessons.forEach(lesson => {
        lessonMap.set(lesson.id, lesson);
      });

      // Validate that all lessons in the request exist in the section
      for (const item of lessons) {
        if (!lessonMap.has(item.id)) {
          throw new ApiError(404, `Lesson with ID ${item.id} not found in this section`);
        }
      }

      // Update each lesson's order_index based on its position in the sorted array
      for (let i = 0; i < lessons.length; i++) {
        const lessonId = lessons[i].id;
        const lesson = lessonMap.get(lessonId);

        if (lesson) {
          // Only update if the order_index has changed
          if (lesson.order_index !== i) {
            console.log(
              `Updating lesson ${lessonId} order_index from ${lesson.order_index} to ${i}`
            );
            await lessonRepository.updateOrder(lessonId, i, transaction);
          }
        }
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

  /**
   * Mark a lesson as completed
   */
  async markLessonCompleted(lesson_id: string, user_id: string): Promise<void> {
    await lessonCompletionRepository.markLessonCompleted(user_id, lesson_id);
  }

  /**
   * Check if a lesson is completed by a user
   */
  async isLessonCompleted(lesson_id: string, user_id: string): Promise<boolean> {
    return await lessonCompletionRepository.isLessonCompleted(user_id, lesson_id);
  }

  /**
   * Get all completed lessons for a user in a course
   */
  async getCompletedLessons(course_id: string, user_id: string): Promise<Lesson[]> {
    return await lessonRepository.findWithCompletionStatus(course_id, user_id);
  }

  /**
   * Calculate the completion percentage of a course for a user
   */
  async getCourseCompletionPercentage(course_id: string, user_id: string): Promise<number> {
    const progress = await lessonCompletionRepository.getCourseProgress(course_id, user_id);
    return progress.progressPercentage;
  }

  /**
   * Get the next uncompleted lesson for a user in a course
   */
  async getNextLesson(course_id: string, user_id: string): Promise<Lesson | null> {
    // Get all lessons for the course with completion status
    const lessonsWithStatus = await lessonRepository.findWithCompletionStatus(course_id, user_id);
    console.log('lessonsWithStatus', lessonsWithStatus);
    // Find the first uncompleted lesson
    for (const lesson of lessonsWithStatus) {
      const completions = lesson.get('completions') as any[];
      if (!completions || completions.length === 0) {
        return lesson;
      }
    }

    return null; // All lessons completed
  }
}

export default new LessonService();
