import { Request, Response, NextFunction } from "express";
import lessonService, {
  LessonUpdateData,
  LessonMetadata,
} from "../services/lesson.service";

import { Role } from "../models/user-role.model";
import { ApiError } from "../utils/api-error";
import { LessonType } from "../models/lesson.model";
import { uploadVideoToCloudinary } from "../utils/upload";

class LessonController {
  /**
   * Create a new lesson
   */
  async createLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    console.log("Message", String(req.body.section_id));
    try {
      const { title, type, is_free } = req.body;
      const section_id = req.query.section_id as string;
      const user_id = req.user!.id;

      // Variables to store video information
      let videoContent = null;
      let videoDuration = undefined;
      let videoPublicId = null;
      let thumbnailUrl = null;

      // Handle video upload
      if (req.file) {
        try {
          // Upload video to Cloudinary
          const uploadResult = await uploadVideoToCloudinary(req.file);

          // Store video information
          videoContent = uploadResult.url;
          videoPublicId = uploadResult.public_id;
          thumbnailUrl = uploadResult.thumbnail_url;

          // Always use the duration from Cloudinary
          videoDuration = Math.round(uploadResult.duration);

          console.log(`Video duration extracted: ${videoDuration} seconds`);
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          return next(
            new ApiError(500, "Failed to upload video to Cloudinary")
          );
        }
      } else {
        return next(new ApiError(400, "Video file is required"));
      }

      // Create metadata object with video information
      const metadata: LessonMetadata = {
        public_id: videoPublicId,
        thumbnail_url: thumbnailUrl,
        resource_type: "video",
        format: req.file?.mimetype?.split("/")[1] || "mp4",
        created_at: new Date().toISOString(),
        tags: ["video", "lesson"],
      };

      console.log(`Creating lesson with metadata: ${JSON.stringify(metadata)}`);

      // Let the service handle the order_index automatically
      const lesson = await lessonService.createLesson(
        {
          section_id,
          title,
          type: (type as LessonType) || LessonType.VIDEO,
          content: videoContent,
          duration: videoDuration,
          is_free: is_free === "true" || is_free === true,
          metadata, // Pass as object, service will handle conversion to JSON
        },
        user_id
      );

      res.status(201).json({
        success: true,
        data: lesson,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a lesson by ID
   */
  async getLessonById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Check if user has access to this lesson
      await lessonService.checkLessonAccess(id, user_id, isAdmin);

      const lesson = await lessonService.getLessonById(id);

      // Transform lesson to include parsed metadata in the response
      const lessonObj: any = lesson.toJSON();

      // If the lesson has parsedMetadata (added by the service), include it in the response
      if ((lesson as any).parsedMetadata) {
        lessonObj.parsedMetadata = (lesson as any).parsedMetadata;
      }

      res.status(200).json({
        success: true,
        data: lessonObj,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all lessons for a section
   */
  async getLessonsBySection(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const section_id = req.params.sectionId;
      // User authentication is handled by middleware

      // TODO: Check if user has access to this section
      // This would be implemented when enrollment functionality is added

      const lessons = await lessonService.getLessonsBySection(section_id);

      // Transform lessons to include parsed metadata in the response
      const transformedLessons = lessons.map((lesson) => {
        const lessonObj: any = lesson.toJSON();

        // If the lesson has parsedMetadata (added by the service), include it in the response
        if ((lesson as any).parsedMetadata) {
          lessonObj.parsedMetadata = (lesson as any).parsedMetadata;
        }

        return lessonObj;
      });

      res.status(200).json({
        success: true,
        data: transformedLessons,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a lesson
   */
  async updateLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const { title, type, is_free } = req.body;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Variables to store video information
      let videoContent: string | undefined = undefined;
      let videoDuration: number | undefined = undefined;

      // Get the current lesson to access its metadata
      const currentLesson = await lessonService.getLessonById(id);
      let currentMetadata = null;

      // Parse current metadata if it exists
      if (currentLesson.metadata) {
        try {
          currentMetadata = JSON.parse(currentLesson.metadata);
        } catch (e) {
          console.error("Error parsing current metadata:", e);
        }
      }

      // Variables to store new metadata
      let newMetadata = currentMetadata || {};
      let metadataUpdated = false;

      // Handle video file upload
      if (req.file) {
        try {
          // Upload new video to Cloudinary
          const uploadResult = await uploadVideoToCloudinary(req.file);

          // Store video information
          videoContent = uploadResult.url;

          // Always use the duration from Cloudinary
          videoDuration = Math.round(uploadResult.duration);

          // Update metadata with new video information
          newMetadata = {
            ...newMetadata,
            public_id: uploadResult.public_id,
            thumbnail_url: uploadResult.thumbnail_url,
            format:
              uploadResult.format || req.file?.mimetype?.split("/")[1] || "mp4",
            resource_type: "video",
            updated_at: new Date().toISOString(),
          } as LessonMetadata;
          metadataUpdated = true;

          console.log(`Video duration extracted: ${videoDuration} seconds`);
          console.log(`Updated metadata with new video information`);
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          return next(
            new ApiError(500, "Failed to upload video to Cloudinary")
          );
        }
      }

      // Only update the fields that were provided
      const updateData: LessonUpdateData = {};

      if (title !== undefined) updateData.title = title;
      if (type !== undefined) updateData.type = type as LessonType;
      if (videoContent !== undefined) updateData.content = videoContent;
      if (videoDuration !== undefined) updateData.duration = videoDuration;
      if (is_free !== undefined)
        updateData.is_free = is_free === "true" || is_free === true;
      if (metadataUpdated) updateData.metadata = JSON.stringify(newMetadata);

      const lesson = await lessonService.updateLesson(
        id,
        updateData,
        user_id,
        isAdmin
      );

      res.status(200).json({
        success: true,
        data: lesson,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Get the lesson to check if we need to delete a video from Cloudinary
      const lesson = await lessonService.getLessonById(id);

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
        } catch (parseError) {
          console.error("Error parsing metadata:", parseError);
          // Continue with deletion even if metadata parsing fails
        }
      }

      await lessonService.deleteLesson(id, user_id, isAdmin);

      res.status(200).json({
        success: true,
        message: "Lesson deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder lessons in a section
   */
  async reorderLessons(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { section_id, lesson_ids } = req.body;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Validate required fields
      if (!section_id) {
        return next(new ApiError(400, "section_id is required"));
      }

      if (
        !lesson_ids ||
        !Array.isArray(lesson_ids) ||
        lesson_ids.length === 0
      ) {
        return next(new ApiError(400, "lesson_ids must be a non-empty array"));
      }

      // Generate order_indices automatically (0, 1, 2, ...)
      const lessons = lesson_ids.map((id: string, index: number) => ({
        id,
        order_index: index,
      }));

      console.log(
        `Reordering lessons with auto-generated indices: ${JSON.stringify(
          lessons
        )}`
      );

      await lessonService.reorderLessons(section_id, lessons, user_id, isAdmin);

      res.status(200).json({
        success: true,
        message: "Lessons reordered successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a lesson as completed
   */
  async markLessonCompleted(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const lesson_id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Check if user has access to this lesson
      await lessonService.checkLessonAccess(lesson_id, user_id, isAdmin);

      await lessonService.markLessonCompleted(lesson_id, user_id);

      res.status(200).json({
        success: true,
        message: "Lesson marked as completed",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if a lesson is completed
   */
  async isLessonCompleted(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const lesson_id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some(
        (role: any) => role.role === Role.ADMIN
      );

      // Check if user has access to this lesson
      await lessonService.checkLessonAccess(lesson_id, user_id, isAdmin);

      const isCompleted = await lessonService.isLessonCompleted(
        lesson_id,
        user_id
      );

      res.status(200).json({
        success: true,
        data: { is_completed: isCompleted },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all completed lessons for a user in a course
   */
  async getCompletedLessons(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const user_id = req.user!.id;

      const completedLessons = await lessonService.getCompletedLessons(
        course_id,
        user_id
      );

      res.status(200).json({
        success: true,
        data: completedLessons,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get course completion percentage
   */
  async getCourseCompletionPercentage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const user_id = req.user!.id;

      const percentage = await lessonService.getCourseCompletionPercentage(
        course_id,
        user_id
      );

      res.status(200).json({
        success: true,
        data: { completion_percentage: percentage },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get next lesson for a user in a course
   */
  async getNextLesson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const user_id = req.user!.id;

      const nextLesson = await lessonService.getNextLesson(course_id, user_id);

      res.status(200).json({
        success: true,
        data: nextLesson,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new LessonController();
