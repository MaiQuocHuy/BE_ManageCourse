import express from "express";
import userController from "../controllers/user.controller";
import { authenticate, extractDeviceInfo } from '../middleware/auth.middleware';
import { Role } from '../models/user-role.model';

import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema,
  roleSchema,
} from '../validators/user.validator';
import { upload } from '../middleware/upload.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { authorize } from '../middleware/role.middleware';

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
  '/register',
  extractDeviceInfo,
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
 *               password:
 *                 type: string
 *           examples:
 *             admin:
 *               summary: Admin credentials
 *               value:
 *                 email: admin@example.com
 *                 password: admin123123@
 *             instructor:
 *               summary: Instructor credentials
 *               value:
 *                 email: instructor@example.com
 *                 password: instructor123@
 *             student:
 *               summary: Student credentials
 *               value:
 *                 email: student@example.com
 *                 password: student123@
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post('/login', extractDeviceInfo, validateRequest(loginSchema), userController.login);

/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: Log out from current device
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Optional - if not provided, will logout all sessions for current user
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/logout', authenticate, extractDeviceInfo, userController.logout);

/**
 * @swagger
 * /api/users/logout-all:
 *   post:
 *     summary: Log out from all devices
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/logout-all', authenticate, userController.logoutAllDevices);

/**
 * @swagger
 * /api/users/logout-device/{tokenId}:
 *   post:
 *     summary: Log out from specific device
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Token ID to logout
 *     responses:
 *       200:
 *         description: Device logged out successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.post('/logout-device/:tokenId', authenticate, userController.logoutDevice);

/**
 * @swagger
 * /api/users/logout-device-jti/{jti}:
 *   post:
 *     summary: Log out from specific device by JTI (immediate revocation)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jti
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT ID to logout immediately
 *     responses:
 *       200:
 *         description: Device session terminated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.post('/logout-device-jti/:jti', authenticate, userController.logoutDeviceByJti);

/**
 * @swagger
 * /api/users/sessions:
 *   get:
 *     summary: Get active sessions for current user (enhanced with JTI tracking)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions with JTI data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Database ID (0 for JTI-based sessions)
 *                       jti:
 *                         type: string
 *                         description: JWT ID for immediate revocation
 *                       device_name:
 *                         type: string
 *                       ip_address:
 *                         type: string
 *                       last_used_at:
 *                         type: string
 *                         format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       is_current:
 *                         type: boolean
 *                       token_version:
 *                         type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     current_jti:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/sessions', authenticate, userController.getActiveSessions);

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
 *       401:
 *         description: Token version mismatch
 *       500:
 *         description: Server error
 */
router.post('/refresh-token', extractDeviceInfo, userController.refreshToken);

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

router.get('/me', authenticate, userController.getCurrentUser);


/**
 * @swagger
 * /api/users/token-stats:
 *   get:
 *     summary: Get token statistics (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token statistics from Redis and Database
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
 *                     redis:
 *                       type: object
 *                       properties:
 *                         totalJtis:
 *                           type: integer
 *                         totalRefreshTokens:
 *                           type: integer
 *                         memoryUsage:
 *                           type: string
 *                     database:
 *                       type: object
 *                       properties:
 *                         totalRefreshTokens:
 *                           type: integer
 *                         activeRefreshTokens:
 *                           type: integer
 *                         revokedRefreshTokens:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.get('/token-stats', authenticate, authorize([Role.ADMIN]), userController.getTokenStats);

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

router.get('/:id', authenticate, userController.getUserById);

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
  '/:id',
  authenticate,
  upload.single('profile_image'),
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
  '/:id/password',
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
router.get('/', authenticate, authorize([Role.ADMIN]), userController.getAllUsers);

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
  '/:id/roles',
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
  '/:id/roles',
  authenticate,
  authorize([Role.ADMIN]),
  validateRequest(roleSchema),
  userController.removeUserRole
);
router.delete('/:id', authenticate, userController.deleteUser);

export default router;
