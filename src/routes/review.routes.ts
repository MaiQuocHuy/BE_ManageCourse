import { Router } from 'express';
import reviewController from '../controllers/review.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { Role } from '../models/user-role.model';
import { validateRequest } from '../middleware/validation.middleware';
import {
  createReviewSchema,
  updateReviewSchema,
  getReviewByIdSchema,
  getUserReviewForCourseSchema,
  deleteReviewSchema,
  addInstructorResponseSchema,
  getCourseReviewsSchema,
  getCourseRatingSchema,
  getInstructorReviewsSchema,
  getHighestRatedCoursesSchema,
} from '../validators/review.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Course review management endpoints
 */

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create or update a review for a course
 *     tags: [Reviews]
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
 *               - rating
 *             properties:
 *               course_id:
 *                 type: string
 *                 description: ID of the course being reviewed
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating for the course (1-5)
 *               review_text:
 *                 type: string
 *                 description: Review comment
 *             example:
 *               course_id: "course123"
 *               rating: 4
 *               review_text: "Great course, very informative!"
 *     responses:
 *       201:
 *         description: Review created or updated successfully
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
 *                     id:
 *                       type: string
 *                       description: Review ID
 *                     course_id:
 *                       type: string
 *                       description: Course ID
 *                     user_id:
 *                       type: string
 *                       description: ID of the user who wrote the review
 *                     rating:
 *                       type: integer
 *                       description: Rating (1-5)
 *                     review_text:
 *                       type: string
 *                       description: Review comment
 *                     instructor_response:
 *                       type: string
 *                       nullable: true
 *                       description: Instructor's response to the review
 *                     response_date:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Date when instructor responded
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review creation date
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review update date
 *               example:
 *                 success: true
 *                 data:
 *                   id: "review123"
 *                   course_id: "course123"
 *                   user_id: "user123"
 *                   rating: 4
 *                   review_text: "Great course!"
 *                   instructor_response: null
 *                   response_date: null
 *                   created_at: "2025-05-23T09:26:00Z"
 *                   updated_at: "2025-05-23T09:26:00Z"
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User not enrolled in course or unauthorized
 *       404:
 *         description: Course not found
 */
router.post(
  '/',
  authenticate,
  authorize([Role.STUDENT]),
  validateRequest(createReviewSchema),
  reviewController.createReview
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   get:
 *     summary: Get a review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review found
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
 *                     id:
 *                       type: string
 *                       description: Review ID
 *                     course_id:
 *                       type: string
 *                       description: Course ID
 *                     user_id:
 *                       type: string
 *                       description: ID of the user who wrote the review
 *                     rating:
 *                       type: integer
 *                       description: Rating (1-5)
 *                     review_text:
 *                       type: string
 *                       description: Review comment
 *                     instructor_response:
 *                       type: string
 *                       nullable: true
 *                       description: Instructor's response to the review
 *                     response_date:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Date when instructor responded
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review creation date
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review update date
 *               example:
 *                 success: true
 *                 data:
 *                   id: "review123"
 *                   course_id: "course123"
 *                   user_id: "user123"
 *                   rating: 4
 *                   review_text: "Great course!"
 *                   instructor_response: null
 *                   response_date: null
 *                   created_at: "2025-05-23T09:26:00Z"
 *                   updated_at: "2025-05-23T09:26:00Z"
 *       404:
 *         description: Review not found
 */
router.get('/:id', validateRequest(getReviewByIdSchema), reviewController.getReviewById);

/**
 * @swagger
 * /api/reviews/course/{courseId}/user:
 *   get:
 *     summary: Get current user's review for a specific course
 *     tags: [Reviews]
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
 *         description: User's review or indication that user hasn't reviewed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           description: Review ID
 *                         course_id:
 *                           type: string
 *                           description: Course ID
 *                         user_id:
 *                           type: string
 *                           description: ID of the user who wrote the review
 *                         rating:
 *                           type: integer
 *                           description: Rating (1-5)
 *                         review_text:
 *                           type: string
 *                           description: Review comment
 *                         instructor_response:
 *                           type: string
 *                           nullable: true
 *                           description: Instructor's response to the review
 *                         response_date:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           description: Date when instructor responded
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           description: Review creation date
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                           description: Review update date
 *                     - type: object
 *                       properties:
 *                         reviewed:
 *                           type: boolean
 *                           example: false
 *               example:
 *                 success: true
 *                 data:
 *                   reviewed: false
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course not found
 */
router.get(
  '/course/:courseId/user',
  authenticate,
  validateRequest(getUserReviewForCourseSchema),
  reviewController.getUserReviewForCourse
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Updated rating for the course (1-5)
 *               review_text:
 *                 type: string
 *                 description: Updated review comment
 *             example:
 *               rating: 5
 *               review_text: "Updated: Even better than I thought!"
 *     responses:
 *       200:
 *         description: Review updated successfully
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
 *                     id:
 *                       type: string
 *                       description: Review ID
 *                     course_id:
 *                       type: string
 *                       description: Course ID
 *                     user_id:
 *                       type: string
 *                       description: ID of the user who wrote the review
 *                     rating:
 *                       type: integer
 *                       description: Rating (1-5)
 *                     review_text:
 *                       type: string
 *                       description: Review comment
 *                     instructor_response:
 *                       type: string
 *                       nullable: true
 *                       description: Instructor's response to the review
 *                     response_date:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Date when instructor responded
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review creation date
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review update date
 *               example:
 *                 success: true
 *                 data:
 *                   id: "review123"
 *                   course_id: "course123"
 *                   user_id: "user123"
 *                   rating: 5
 *                   review_text: "Updated: Even better than I thought!"
 *                   instructor_response: null
 *                   response_date: null
 *                   created_at: "2025-05-23T09:26:00Z"
 *                   updated_at: "2025-05-23T10:00:00Z"
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Can only update own reviews
 *       404:
 *         description: Review not found
 */
router.put(
  '/:id',
  authenticate,
  authorize([Role.STUDENT]),
  validateRequest(updateReviewSchema),
  reviewController.updateReview
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *               example:
 *                 success: true
 *                 message: Review deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Can only delete own reviews
 *       404:
 *         description: Review not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize([Role.STUDENT]),
  validateRequest(deleteReviewSchema),
  reviewController.deleteReview
);

/**
 * @swagger
 * /api/reviews/{id}/response:
 *   post:
 *     summary: Add instructor response to a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instructor_response
 *             properties:
 *               instructor_response:
 *                 type: string
 *                 description: Instructor's response to the review
 *             example:
 *               instructor_response: "Thank you for your feedback!"
 *     responses:
 *       200:
 *         description: Response added successfully
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
 *                     id:
 *                       type: string
 *                       description: Review ID
 *                     course_id:
 *                       type: string
 *                       description: Course ID
 *                     user_id:
 *                       type: string
 *                       description: ID of the user who wrote the review
 *                     rating:
 *                       type: integer
 *                       description: Rating (1-5)
 *                     review_text:
 *                       type: string
 *                       description: Review comment
 *                     instructor_response:
 *                       type: string
 *                       description: Instructor's response to the review
 *                     response_date:
 *                       type: string
 *                       format: date-time
 *                       description: Date when instructor responded
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review creation date
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Review update date
 *               example:
 *                 success: true
 *                 data:
 *                   id: "review123"
 *                   course_id: "course123"
 *                   user_id: "user123"
 *                   rating: 4
 *                   review_text: "Great course!"
 *                   instructor_response: "Thank you for your feedback!"
 *                   response_date: "2025-05-23T10:00:00Z"
 *                   created_at: "2025-05-23T09:26:00Z"
 *                   updated_at: "2025-05-23T10:00:00Z"
 *       400:
 *         description: Missing instructor response
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Can only respond to reviews for own courses
 *       404:
 *         description: Review not found
 */
router.post(
  '/:id/response',
  authenticate,
  authorize([Role.INSTRUCTOR]),
  validateRequest(addInstructorResponseSchema),
  reviewController.addInstructorResponse
);

/**
 * @swagger
 * /api/reviews/course/{courseId}:
 *   get:
 *     summary: Get all reviews for a course
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of reviews per page
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by specific rating
 *     responses:
 *       200:
 *         description: List of reviews for the course
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
 *                     reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Review ID
 *                           course_id:
 *                             type: string
 *                             description: Course ID
 *                           user_id:
 *                             type: string
 *                             description: ID of the user who wrote the review
 *                           rating:
 *                             type: integer
 *                             description: Rating (1-5)
 *                           review_text:
 *                             type: string
 *                             description: Review comment
 *                           instructor_response:
 *                             type: string
 *                             nullable: true
 *                             description: Instructor's response to the review
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             description: Review creation date
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             description: Review update date
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *               example:
 *                 success: true
 *                 data:
 *                   reviews:
 *                     - id: "review123"
 *                       course_id: "course123"
 *                       user_id: "user123"
 *                       rating: 4
 *                       review_text: "Great course!"
 *                       instructor_response: null
 *                       created_at: "2025-05-23T09:26:00Z"
 *                       updated_at: "2025-05-23T09:26:00Z"
 *                   total: 1
 *                   page: 1
 *                   limit: 10
 *       404:
 *         description: Course not found
 */
router.get(
  '/course/:courseId',
  validateRequest(getCourseReviewsSchema),
  reviewController.getCourseReviews
);

/**
 * @swagger
 * /api/reviews/course/{courseId}/average:
 *   get:
 *     summary: Get average rating for a course
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Average rating for the course
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
 *                     course_id:
 *                       type: string
 *                     average_rating:
 *                       type: number
 *                       format: float
 *               example:
 *                 success: true
 *                 data:
 *                   course_id: "course123"
 *                   average_rating: 4.5
 *       404:
 *         description: Course not found
 */
router.get(
  '/course/:courseId/average',
  validateRequest(getCourseRatingSchema),
  reviewController.getAverageRating
);

/**
 * @swagger
 * /api/reviews/course/{courseId}/distribution:
 *   get:
 *     summary: Get rating distribution for a course
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Rating distribution for the course
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
 *                     1:
 *                       type: integer
 *                       description: Number of 1-star reviews
 *                     2:
 *                       type: integer
 *                       description: Number of 2-star reviews
 *                     3:
 *                       type: integer
 *                       description: Number of 3-star reviews
 *                     4:
 *                       type: integer
 *                       description: Number of 4-star reviews
 *                     5:
 *                       type: integer
 *                       description: Number of 5-star reviews
 *               example:
 *                 success: true
 *                 data:
 *                   1: 5
 *                   2: 10
 *                   3: 20
 *                   4: 30
 *                   5: 35
 *       404:
 *         description: Course not found
 */
router.get(
  '/course/:courseId/distribution',
  validateRequest(getCourseRatingSchema),
  reviewController.getRatingDistribution
);

/**
 * @swagger
 * /api/reviews/instructor/{instructorId}:
 *   get:
 *     summary: Get all reviews for courses by an instructor
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
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
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of reviews per page
 *     responses:
 *       200:
 *         description: List of reviews for instructor's courses
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
 *                     reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Review ID
 *                           course_id:
 *                             type: string
 *                             description: Course ID
 *                           user_id:
 *                             type: string
 *                             description: ID of the user who wrote the review
 *                           rating:
 *                             type: integer
 *                             description: Rating (1-5)
 *                           review_text:
 *                             type: string
 *                             description: Review comment
 *                           instructor_response:
 *                             type: string
 *                             nullable: true
 *                             description: Instructor's response to the review
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             description: Review creation date
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             description: Review update date
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *               example:
 *                 success: true
 *                 data:
 *                   reviews:
 *                     - id: "review123"
 *                       course_id: "course123"
 *                       user_id: "user123"
 *                       rating: 4
 *                       review_text: "Great course!"
 *                       instructor_response: null
 *                       created_at: "2025-05-23T09:26:00Z"
 *                       updated_at: "2025-05-23T09:26:00Z"
 *                   total: 1
 *                   page: 1
 *                   limit: 10
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Can only access own course reviews
 *       404:
 *         description: Instructor not found
 */
router.get(
  '/instructor/:instructorId',
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(getInstructorReviewsSchema),
  reviewController.getInstructorReviews
);

/**
 * @swagger
 * /api/reviews/highest-rated:
 *   get:
 *     summary: Get highest rated courses
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of courses per page
 *     responses:
 *       200:
 *         description: List of highest rated courses
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
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           thumbnail:
 *                             type: string
 *                           price:
 *                             type: number
 *                           average_rating:
 *                             type: number
 *                             format: float
 *                           review_count:
 *                             type: integer
 *                           instructor:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               profile_thumbnail:
 *                                 type: string
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *               example:
 *                 success: true
 *                 data:
 *                   courses:
 *                     - id: "course123"
 *                       title: "Introduction to Programming"
 *                       thumbnail: "http://example.com/thumbnail.jpg"
 *                       price: 49.99
 *                       average_rating: 4.8
 *                       review_count: 100
 *                       instructor:
 *                         id: "instructor123"
 *                         name: "John Doe"
 *                         profile_thumbnail: "http://example.com/profile.jpg"
 *                   total: 1
 *                   page: 1
 *                   limit: 10
 */
router.get(
  '/highest-rated',
  validateRequest(getHighestRatedCoursesSchema),
  reviewController.getHighestRatedCourses
);

export default router;
