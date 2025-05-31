import { Router } from 'express';
import cacheController from '../controllers/cache.controller';

const router = Router();

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/stats', cacheController.getCacheStats);

/**
 * @swagger
 * /api/cache/health:
 *   get:
 *     summary: Check cache health
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache health check completed
 *       500:
 *         description: Server error
 */
router.get('/health', cacheController.healthCheck);

/**
 * @swagger
 * /api/cache/clear:
 *   delete:
 *     summary: Clear all category cache
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       500:
 *         description: Server error
 */
router.delete('/clear', cacheController.clearCategoryCache);

/**
 * @swagger
 * /api/cache/warmup:
 *   post:
 *     summary: Warm up cache with frequently accessed data
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache warmed up successfully
 *       500:
 *         description: Server error
 */
router.post('/warmup', cacheController.warmUpCache);

/**
 * @swagger
 * /api/cache/test/{categoryId}:
 *   get:
 *     summary: Test cache performance with a specific category
 *     tags: [Cache]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID to test cache with
 *     responses:
 *       200:
 *         description: Cache test completed
 *       400:
 *         description: Invalid category ID
 *       500:
 *         description: Server error
 */
router.get('/test/:categoryId', cacheController.testCache);

export default router;
