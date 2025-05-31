import express from "express";
import courseController from "../controllers/course.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import { upload, optionalFileUpload } from '../middleware/upload.middleware';
import {
  createCourseSchema,
  updateCourseSchema,
  getCourseSchema,
  approveCourseSchema,
  updateCourseStatusSchema,
  getCoursesByInstructorSchema,
  searchCoursesSchema,
  getCoursesSchema,
  getRecommendedCoursesSchema,
} from '../validators/course.validator';

const router = express.Router();

// Create a new course (instructor, admin only)
/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create a new course (instructor, admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Category ID
 *             required:
 *               - title
 *               - description
 *               - price
 *               - thumbnail
 *               - categories
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  upload.single('thumbnail'),
  validateRequest(createCourseSchema),
  courseController.createCourse
);

// Get all courses with pagination and filtering
/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Get all courses
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: is_published
 *         schema:
 *           type: boolean
 *         description: Filter by publication status
 *       - in: query
 *         name: is_approved
 *         schema:
 *           type: boolean
 *         description: Filter by approved status
 *     responses:
 *       200:
 *         description: List of courses
 *       500:
 *         description: Server error
 */
router.get('/', validateRequest(getCoursesSchema), courseController.getCourses);

// Get all courses for moderation (admin only)
/**
 * @swagger
 * /api/courses/moderation:
 *   get:
 *     summary: Get all courses for moderation (admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, published, draft, approved]
 *         description: Filter courses by status
 *     responses:
 *       200:
 *         description: List of courses for moderation
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  '/moderation',
  authenticate,
  authorize([Role.ADMIN]),
  courseController.getAllCoursesForModeration
);

// Search courses by keyword
/**
 * @swagger
 * /api/courses/search:
 *   get:
 *     summary: Search courses by keyword
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: Search keyword
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: is_published
 *         schema:
 *           type: boolean
 *         description: Filter by publication status
 *       - in: query
 *         name: is_approved
 *         schema:
 *           type: boolean
 *         description: Filter by approved status
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.get('/search', validateRequest(searchCoursesSchema), courseController.searchCourses);

// Get recommended courses for a user
/**
 * @swagger
 * /api/courses/recommended:
 *   get:
 *     summary: Get recommended courses for a user
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of recommended courses
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  '/recommended',
  authenticate,
  validateRequest(getRecommendedCoursesSchema),
  courseController.getRecommendedCourses
);

// Get courses by instructor ID
/**
 * @swagger
 * /api/courses/instructor/{instructorId}:
 *   get:
 *     summary: Get courses by instructor ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Instructor ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: is_published
 *         schema:
 *           type: boolean
 *         description: Filter by publication status
 *       - in: query
 *         name: is_approved
 *         schema:
 *           type: boolean
 *         description: Filter by approved status
 *     responses:
 *       200:
 *         description: List of courses by the instructor
 *       404:
 *         description: Instructor not found
 *       500:
 *         description: Server error
 */
router.get(
  '/instructor/:instructorId',
  validateRequest(getCoursesByInstructorSchema),
  courseController.getCoursesByInstructorId
);

// Get a course by ID
/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Get a course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course details
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.get('/:id', validateRequest(getCourseSchema), courseController.getCourseById);

// Update a course (instructor only)
/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     summary: Update a course  (instructor only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *               is_published:
 *                 type: boolean
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Category ID
 *                 description: Comma-separated list of category IDs
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  optionalFileUpload('thumbnail'),
  validateRequest(updateCourseSchema),
  courseController.updateCourse
);

// Delete a course (instructor only)
/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Delete a course (instructor only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getCourseSchema),
  courseController.deleteCourse
);

// Get categories for a course
/**
 * @swagger
 * /api/courses/{id}/categories:
 *   get:
 *     summary: Get categories for a course
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: List of categories for the course
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id/categories',
  validateRequest(getCourseSchema),
  courseController.getCourseCategories
);

// Approve a course (admin only)
/**
 * @swagger
 * /api/courses/{id}/approve:
 *   patch:
 *     summary: Approve a course (admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_approved:
 *                 type: boolean
 *             required:
 *               - is_approved
 *     responses:
 *       200:
 *         description: Course approval status updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/approve',
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(approveCourseSchema),
  courseController.approveCourse
);

// Update course publication status (instructor only)
/**
 * @swagger
 * /api/courses/{id}/status:
 *   patch:
 *     summary: Update course publication status (instructor only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_published:
 *                 type: boolean
 *             required:
 *               - is_published
 *     responses:
 *       200:
 *         description: Course publication status updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize([Role.INSTRUCTOR]),
  validateRequest(updateCourseStatusSchema),
  courseController.updateCourseStatus
);

export default router;
