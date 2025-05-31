import express from "express";
import lessonController from "../controllers/lesson.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import { videoUpload } from "../middleware/upload.middleware";
import {
  getLessonSchema,
  getLessonsBySectionSchema,
  deleteLessonSchema,
  markLessonCompletedSchema,
  isLessonCompletedSchema,
  getCompletedLessonsSchema,
  getCourseCompletionPercentageSchema,
  getNextLessonSchema,
  reorderLessonsSchema,
} from "../validators/lesson.validator";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lessons
 *   description: Course lesson management endpoints
 */

// Reorder lessons (instructor or admin only)
/**
 * @swagger
 * /api/lessons/reorder:
 *   put:
 *     summary: Reorder lessons in a section
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               section_id:
 *                 type: string
 *                 description: ID of the section
 *               lesson_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of lesson IDs in the desired order (first item will have order_index 0, second will have 1, etc.)
 *             required:
 *               - section_id
 *               - lesson_ids
 *     responses:
 *       200:
 *         description: Lessons reordered successfully
 *       400:
 *         description: Invalid input (arrays must have same length)
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section or lesson not found
 *       500:
 *         description: Server error
 */
router.put(
  "/reorder",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(reorderLessonsSchema),
  lessonController.reorderLessons
);
// Create a new lesson (instructor or admin only)
/**
 * @swagger
 * /api/lessons:
 *   post:
 *     summary: Create a new lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: section_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Lesson title
 *               type:
 *                 type: string
 *                 enum: [video]
 *                 description: Lesson type (defaults to video)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file to upload to Cloudinary (duration will be automatically extracted)
 *             required:
 *               - title
 *               - video
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  videoUpload.single("video"),
  lessonController.createLesson
);

// Get all lessons for a section
/**
 * @swagger
 * /api/lessons/section/{sectionId}:
 *   get:
 *     summary: Get all lessons for a section
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: List of lessons
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  "/section/:sectionId",
  authenticate,
  validateRequest(getLessonsBySectionSchema),
  lessonController.getLessonsBySection
);

// Get a lesson by ID
/**
 * @swagger
 * /api/lessons/{id}:
 *   get:
 *     summary: Get a lesson by ID
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Lesson details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  authenticate,
  validateRequest(getLessonSchema),
  lessonController.getLessonById
);

// Update a lesson (instructor or admin only)
/**
 * @swagger
 * /api/lessons/{id}:
 *   put:
 *     summary: Update a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Lesson title
 *               type:
 *                 type: string
 *                 enum: [video]
 *                 description: Lesson type
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file to upload to Cloudinary (will replace existing video, duration will be automatically extracted)
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.put(
  "/:id",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  videoUpload.single("video"),
  lessonController.updateLesson
);

// Delete a lesson (instructor or admin only)
/**
 * @swagger
 * /api/lessons/{id}:
 *   delete:
 *     summary: Delete a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Lesson deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(deleteLessonSchema),
  lessonController.deleteLesson
);

// Mark a lesson as completed
/**
 * @swagger
 * /api/lessons/{id}/complete:
 *   post:
 *     summary: Mark a lesson as completed
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Lesson marked as completed
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/complete",
  authenticate,
  validateRequest(markLessonCompletedSchema),
  lessonController.markLessonCompleted
);

// Check if a lesson is completed
/**
 * @swagger
 * /api/lessons/{id}/is-completed:
 *   get:
 *     summary: Check if a lesson is completed
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     is_completed:
 *                       type: boolean
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id/is-completed",
  authenticate,
  validateRequest(isLessonCompletedSchema),
  lessonController.isLessonCompleted
);

// Get all completed lessons for a user in a course
/**
 * @swagger
 * /api/lessons/completed/{courseId}:
 *   get:
 *     summary: Get all completed lessons for a user in a course
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: List of completed lessons
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/completed/:courseId",
  authenticate,
  validateRequest(getCompletedLessonsSchema),
  lessonController.getCompletedLessons
);

// Get course completion percentage
/**
 * @swagger
 * /api/lessons/completion-percentage/{courseId}:
 *   get:
 *     summary: Get course completion percentage
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Completion percentage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     completion_percentage:
 *                       type: number
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/completion-percentage/:courseId",
  authenticate,
  validateRequest(getCourseCompletionPercentageSchema),
  lessonController.getCourseCompletionPercentage
);

// Get next lesson for a user in a course
/**
 * @swagger
 * /api/lessons/next/{courseId}:
 *   get:
 *     summary: Get next lesson for a user in a course
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Next lesson details
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/next/:courseId",
  authenticate,
  validateRequest(getNextLessonSchema),
  lessonController.getNextLesson
);

export default router;
