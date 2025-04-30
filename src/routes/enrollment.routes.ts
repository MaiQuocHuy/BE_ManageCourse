import express from "express";
import enrollmentController from "../controllers/enrollment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import {
  createEnrollmentSchema,
  getEnrollmentSchema,
  checkEnrollmentSchema,
  getUserEnrollmentsSchema,
  getCourseEnrollmentsSchema,
  getCourseRevenueSchema,
  getStudentCountByInstructorSchema,
  getMostPopularCoursesSchema,
} from "../validators/enrollment.validator";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Enrollments
 *   description: Enrollment management endpoints
 */

/**
 * @swagger
 * /api/enrollments:
 *   post:
 *     summary: Create a new enrollment
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - course_id
 *             properties:
 *               course_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Enrollment created successfully
 *       400:
 *         description: Invalid input or user already enrolled
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authenticate,
  authorize([Role.STUDENT]),
  validateRequest(createEnrollmentSchema),
  enrollmentController.createEnrollment
);

/**
 * @swagger
 * /api/enrollments/{id}:
 *   get:
 *     summary: Get enrollment by ID
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enrollment details
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Enrollment not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  authenticate,
  validateRequest(getEnrollmentSchema),
  enrollmentController.getEnrollmentById
);

/**
 * @swagger
 * /api/enrollments/check:
 *   get:
 *     summary: Check if user is enrolled in a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: course_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enrollment status
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get(
  "/check",
  authenticate,
  validateRequest(checkEnrollmentSchema),
  enrollmentController.checkEnrollment
);

/**
 * @swagger
 * /api/enrollments/user:
 *   get:
 *     summary: Get all courses a user is enrolled in
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for course title
 *     responses:
 *       200:
 *         description: List of enrollments
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get(
  "/user",
  authenticate,
  validateRequest(getUserEnrollmentsSchema),
  enrollmentController.getUserEnrollments
);

/**
 * @swagger
 * /api/enrollments/user/{userId}:
 *   get:
 *     summary: Get all courses a specific user is enrolled in (admin only)
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for course title
 *     responses:
 *       200:
 *         description: List of enrollments
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/user/:userId",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(getUserEnrollmentsSchema),
  enrollmentController.getUserEnrollments
);

/**
 * @swagger
 * /api/enrollments/course/{courseId}:
 *   get:
 *     summary: Get all students enrolled in a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for student name or email
 *     responses:
 *       200:
 *         description: List of enrollments
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/course/:courseId",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getCourseEnrollmentsSchema),
  enrollmentController.getCourseEnrollments
);

/**
 * @swagger
 * /api/enrollments/revenue/{courseId}:
 *   get:
 *     summary: Calculate the total revenue generated by a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course revenue
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.get(
  "/revenue/:courseId",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getCourseRevenueSchema),
  enrollmentController.getCourseRevenue
);

/**
 * @swagger
 * /api/enrollments/instructor/{instructorId}/students:
 *   get:
 *     summary: Get the number of unique students enrolled in an instructor's courses
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student count
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/instructor/:instructorId/students",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getStudentCountByInstructorSchema),
  enrollmentController.getStudentCountByInstructor
);

/**
 * @swagger
 * /api/enrollments/popular:
 *   get:
 *     summary: Get the most popular courses based on enrollment count
 *     tags: [Enrollments]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of popular courses
 *       500:
 *         description: Server error
 */
router.get(
  "/popular",
  validateRequest(getMostPopularCoursesSchema),
  enrollmentController.getMostPopularCourses
);

export default router;
