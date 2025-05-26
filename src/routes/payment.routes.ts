import express from "express";
import paymentController from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import {
  createPaymentSchema,
  getPaymentSchema,
  getUserPaymentsSchema,
  getCoursePaymentsSchema,
  updatePaymentStatusSchema,
  processRefundSchema,
  getRevenueByTimeSchema,
  getRevenueStatisticsSchema,
  getInstructorRevenueSchema,
  getHighestRevenueCoursesSchema,
} from "../validators/payment.validator";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management endpoints
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
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
 *               - payment_method
 *             properties:
 *               course_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *               payment_method:
 *                 type: string
 *                 enum: [credit_card, paypal, stripe, bank_transfer]
 *     responses:
 *       201:
 *         description: Payment created successfully
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
  validateRequest(createPaymentSchema),
  paymentController.createPayment
);

/**
 * @swagger
 * /api/payments/revenue/highest:
 *   get:
 *     summary: Get the highest revenue courses
 *     tags: [Payments]
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
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: List of highest revenue courses
 *       500:
 *         description: Server error
 */
router.get(
  "/revenue/highest",
  validateRequest(getHighestRevenueCoursesSchema),
  paymentController.getHighestRevenueCourses
);

/**
 * @swagger
 * /api/payments/revenue/total:
 *   get:
 *     summary: Get the total revenue
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total revenue
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/revenue/total",
  authenticate,
  authorize([Role.ADMIN]),
  paymentController.getTotalRevenue
);

/**
 * @swagger
 * /api/payments/revenue/time:
 *   get:
 *     summary: Get revenue by time period
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, month, year]
 *           default: day
 *         description: Time period for grouping
 *     responses:
 *       200:
 *         description: Revenue by time period
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/revenue/time",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(getRevenueByTimeSchema),
  paymentController.getRevenueByTime
);

/**
 * @swagger
 * /api/payments/revenue/statistics:
 *   get:
 *     summary: Get revenue statistics
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Revenue statistics
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/revenue/statistics",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(getRevenueStatisticsSchema),
  paymentController.getRevenueStatistics
);

/**
 * @swagger
 * /api/payments/instructor/{instructorId}/revenue:
 *   get:
 *     summary: Get instructor revenue
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Instructor revenue
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get(
  "/instructor/:instructorId/revenue",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getInstructorRevenueSchema),
  paymentController.getInstructorRevenue
);

/**
 * @swagger
 * /api/payments/user:
 *   get:
 *     summary: Get all payments for the current user
 *     tags: [Payments]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *         description: Payment status
 *     responses:
 *       200:
 *         description: List of payments
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get(
  "/user",
  authenticate,
  validateRequest(getUserPaymentsSchema),
  paymentController.getUserPayments
);

/**
 * @swagger
 * /api/payments/user/{userId}:
 *   get:
 *     summary: Get all payments for a specific user (admin only)
 *     tags: [Payments]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *         description: Payment status
 *     responses:
 *       200:
 *         description: List of payments
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
  validateRequest(getUserPaymentsSchema),
  paymentController.getUserPayments
);

/**
 * @swagger
 * /api/payments/course/{courseId}:
 *   get:
 *     summary: Get all payments for a course
 *     tags: [Payments]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *         description: Payment status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for user name or email
 *     responses:
 *       200:
 *         description: List of payments
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
  validateRequest(getCoursePaymentsSchema),
  paymentController.getCoursePayments
);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
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
 *         description: Payment details
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  authenticate,
  validateRequest(getPaymentSchema),
  paymentController.getPaymentById
);

/**
 * @swagger
 * /api/payments/{id}/status:
 *   put:
 *     summary: Update payment status (admin only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, failed, refunded]
 *                 description: Payment status
 *     responses:
 *       200:
 *         description: Payment status updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */

router.put(
  "/:id/status",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(updatePaymentStatusSchema),
  paymentController.updatePaymentStatus
);

/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Process refund for a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/refund",
  authenticate,
  validateRequest(processRefundSchema),
  paymentController.processRefund
);

export default router; 