import express from "express";
import sectionController from "../controllers/section.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import {
  createSectionSchema,
  getSectionSchema,
  getCourseSectionsSchema,
  updateSectionSchema,
  deleteSectionSchema,
  reorderSectionsSchema,
} from "../validators/section.validator";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sections
 *   description: Course section management endpoints
 */

// Create a new section (instructor or admin only)
/**
 * @swagger
 * /api/sections:
 *   post:
 *     summary: Create a new section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               course_id:
 *                 type: string
 *                 description: ID of the course
 *               title:
 *                 type: string
 *                 description: Section title
 *               description:
 *                 type: string
 *                 description: Section description
 *             required:
 *               - course_id
 *               - title
 *               - description
 *     responses:
 *       201:
 *         description: Section created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(createSectionSchema),
  sectionController.createSection
);

// Reorder sections (instructor or admin only)
/**
 * @swagger
 * /api/sections/reorder:
 *   put:
 *     summary: Reorder sections in a course
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               course_id:
 *                 type: string
 *                 description: ID of the course
 *               section_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of section IDs
 *               order_indices:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of order indices corresponding to section_ids
 *             required:
 *               - course_id
 *               - section_ids
 *               - order_indices
 *     responses:
 *       200:
 *         description: Sections reordered successfully
 *       400:
 *         description: Invalid input (arrays must have same length)
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course or section not found
 *       500:
 *         description: Server error
 */
router.put(
  "/reorder",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  sectionController.reorderSections
);

// Get a section by ID
/**
 * @swagger
 * /api/sections/{id}:
 *   get:
 *     summary: Get a section by ID
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  authenticate,
  validateRequest(getSectionSchema),
  sectionController.getSectionById
);

// Get all sections for a course
/**
 * @swagger
 * /api/sections/course/{courseId}:
 *   get:
 *     summary: Get all sections for a course
 *     tags: [Sections]
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
 *         description: List of sections
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.get(
  "/course/:courseId",
  authenticate,
  validateRequest(getCourseSectionsSchema),
  sectionController.getCourseSections
);

// Update a section (instructor or admin only)
/**
 * @swagger
 * /api/sections/{id}:
 *   put:
 *     summary: Update a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Section title
 *                 example: ""
 *               description:
 *                 type: string
 *                 description: Section description
 *                 example: ""
 *     responses:
 *       200:
 *         description: Section updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.put(
  "/:id",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(updateSectionSchema),
  sectionController.updateSection
);

// Delete a section (instructor or admin only)
/**
 * @swagger
 * /api/sections/{id}:
 *   delete:
 *     summary: Delete a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.INSTRUCTOR, Role.ADMIN]),
  validateRequest(deleteSectionSchema),
  sectionController.deleteSection
);

export default router;
