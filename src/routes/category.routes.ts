import express from "express";
import categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "../models/user-role.model";
import { validateRequest } from "../middleware/validation.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
  getCategorySchema,
  getCategoryBySlugSchema,
  courseCategorySchema,
  disassociateCourseSchema,
  getCoursesForCategorySchema,
  getHierarchySchema,
} from "../validators/category.validator";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints
 */

// Create category (admin only)
/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Category name
 *               description:
 *                 type: string
 *                 description: Category description
 *               parent_id:
 *                 type: integer
 *                 description: ID of parent category (null for root categories)
 *                 example: ""
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(createCategorySchema),
  categoryController.createCategory
);

// Get all categories
/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
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
 *         description: Items per page
 *       - in: query
 *         name: parent_id
 *         schema:
 *           type: integer
 *         description: Filter by parent_id (use 'null' for root categories)
 *       - in: query
 *         name: isActive
 *         required: true
 *         schema:
 *           type: boolean
 *         description: Inactive category
 *     responses:
 *       200:
 *         description: List of categories
 *       500:
 *         description: Server error
 */
router.get("/", categoryController.getAllCategories);

// Get category hierarchy
/**
 * @swagger
 * /api/categories/hierarchy:
 *   get:
 *     summary: Get category hierarchy (tree structure)
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         required: true
 *         schema:
 *           type: boolean
 *         description: Inactive category
 *     responses:
 *       200:
 *         description: Category hierarchy
 *       500:
 *         description: Server error
 */
router.get(
  "/hierarchy",
  validateRequest(getHierarchySchema),
  categoryController.getCategoryHierarchy
);

// Add default categories (admin only)
/**
 * @swagger
 * /api/categories/default:
 *   post:
 *     summary: Add default categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default categories added successfully
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post(
  "/default",
  authenticate,
  authorize([Role.ADMIN]),
  categoryController.addDefaultCategories
);

// Get counts of courses in each category
/**
 * @swagger
 * /api/categories/counts:
 *   get:
 *     summary: Get counts of courses in each category
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Course counts for each category
 *       500:
 *         description: Server error
 */
router.get("/counts", categoryController.getCategoryCounts);

// Get category by slug
/**
 * @swagger
 * /api/categories/slug/{slug}:
 *   get:
 *     summary: Get a category by slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *     responses:
 *       200:
 *         description: Category found
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get(
  "/slug/:slug",
  validateRequest(getCategoryBySlugSchema),
  categoryController.getCategoryBySlug
);

// Get categories for a course
/**
 * @swagger
 * /api/categories/course/{courseId}:
 *   get:
 *     summary: Get categories for a course
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: List of categories for the course
 *       404:
 *         description: Course not found
 *       500:
 *         description: Server error
 */
router.get("/course/:courseId", categoryController.getCategoriesForCourse);

// Associate a course with a category
/**
 * @swagger
 * /api/categories/course/{courseId}:
 *   post:
 *     summary: Associate a course with a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *             properties:
 *               category_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Course associated with category successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category or course not found
 *       500:
 *         description: Server error
 */
router.post(
  "/course/:courseId",
  authenticate,
  authorize([Role.ADMIN, Role.INSTRUCTOR]),
  validateRequest(courseCategorySchema),
  categoryController.associateCourseWithCategory
);

// Disassociate a course from a category
/**
 * @swagger
 * /api/categories/course/{courseId}:
 *   delete:
 *     summary: Disassociate a course from a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *             properties:
 *               category_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Course disassociated from category successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Association not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/course/:courseId",
  authenticate,
  authorize([Role.ADMIN, Role.INSTRUCTOR]),
  validateRequest(disassociateCourseSchema),
  categoryController.disassociateCourseFromCategory
);

// Get courses for a category
/**
 * @swagger
 * /api/courses/category/{categoryId}:
 *   get:
 *     summary: Get courses for a category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: include_subcategories
 *         schema:
 *           type: boolean
 *         description: Include courses from subcategories
 *     responses:
 *       200:
 *         description: List of courses for the category
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get(
  "/courses/:categoryId",
  validateRequest(getCoursesForCategorySchema),
  categoryController.getCoursesForCategory
);

// Finally, parameterized ID routes
// Get category by ID
/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category found
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  validateRequest(getCategorySchema),
  categoryController.getCategoryById
);

// Update category (admin only)
/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent_id:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.put(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(updateCategorySchema),
  categoryController.updateCategory
);

// Delete category (admin only)
/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(getCategorySchema),
  categoryController.deleteCategory
);

export default router;
