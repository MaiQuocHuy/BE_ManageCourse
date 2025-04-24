import express from "express";
import userController from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { Role } from "../models/user-role.model";

import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema,
  roleSchema,
} from "../validators/user.validator";
import { upload } from "../middleware/upload.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

// User registration
/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 *       500:
 *         description: Server error
 */
router.post(
  "/register",
  validateRequest(registerSchema),
  userController.register
);
/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: admin123123@
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */

router.post("/login", validateRequest(loginSchema), userController.login);

/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: Log out the user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       400:
 *         description: Missing refresh token
 *       500:
 *         description: Server error
 */

router.post("/logout", userController.logout);

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *       400:
 *         description: Missing or invalid refresh token
 *       500:
 *         description: Server error
 */

router.post("/refresh-token", userController.refreshToken);

// Protected routes - require authentication
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

router.get("/me", authenticate, userController.getCurrentUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

router.get("/:id", authenticate, userController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               profile_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */

router.put(
  "/:id",
  authenticate,
  upload.single("profile_image"),
  validateRequest(updateUserSchema),
  userController.updateUser
);

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */

router.put(
  "/:id/password",
  authenticate,
  validateRequest(changePasswordSchema),
  userController.changePassword
);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */

// Admin only routes
router.get(
  "/",
  authenticate,
  authorize([Role.ADMIN]),
  userController.getAllUsers
);

/**
 * @swagger
 * /api/users/{id}/roles:
 *   post:
 *     summary: Add a role to a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role added
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/roles",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(roleSchema),
  userController.addUserRole
);

/**
 * @swagger
 * /api/users/{id}/roles:
 *   delete:
 *     summary: Remove a role from a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role removed
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id/roles",
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(roleSchema),
  userController.removeUserRole
);
router.delete("/:id", authenticate, userController.deleteUser);

export default router;
