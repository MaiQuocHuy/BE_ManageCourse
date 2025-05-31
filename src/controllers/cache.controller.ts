import { Request, Response } from 'express';
import cacheService from '../services/cache.service';
import categoryService from '../services/category.service';

class CacheController {
  /**
   * Get cache statistics
   */
  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await categoryService.getCacheStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Cache statistics retrieved successfully',
      });
    } catch (error: any) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics',
        error: error.message,
      });
    }
  }

  /**
   * Clear all category cache
   */
  async clearCategoryCache(req: Request, res: Response): Promise<void> {
    try {
      await categoryService.clearCategoryCache();

      res.status(200).json({
        success: true,
        message: 'Category cache cleared successfully',
      });
    } catch (error: any) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: error.message,
      });
    }
  }

  /**
   * Warm up category cache
   */
  async warmUpCache(req: Request, res: Response): Promise<void> {
    try {
      await categoryService.warmUpCache();

      res.status(200).json({
        success: true,
        message: 'Cache warmed up successfully',
      });
    } catch (error: any) {
      console.error('Error warming up cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to warm up cache',
        error: error.message,
      });
    }
  }

  /**
   * Test cache with a specific category
   */
  async testCache(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;

      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required',
        });
        return;
      }

      const startTime = Date.now();

      // First call (cache miss)
      const category1 = await categoryService.getCategoryById(categoryId);
      const firstCallTime = Date.now() - startTime;

      const midTime = Date.now();

      // Second call (cache hit)
      const category2 = await categoryService.getCategoryById(categoryId);
      const secondCallTime = Date.now() - midTime;

      res.status(200).json({
        success: true,
        data: {
          category: category1,
          performance: {
            firstCall: `${firstCallTime}ms (likely cache miss)`,
            secondCall: `${secondCallTime}ms (likely cache hit)`,
            improvement: `${(((firstCallTime - secondCallTime) / firstCallTime) * 100).toFixed(2)}%`,
          },
        },
        message: 'Cache test completed',
      });
    } catch (error: any) {
      console.error('Error testing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test cache',
        error: error.message,
      });
    }
  }

  /**
   * Get cache health check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const stats = await cacheService.getCacheStats();

      res.status(200).json({
        success: true,
        data: {
          redis: stats.available ? 'connected' : 'disconnected',
          stats,
        },
        message: 'Cache health check completed',
      });
    } catch (error: any) {
      console.error('Error checking cache health:', error);
      res.status(500).json({
        success: false,
        message: 'Cache health check failed',
        error: error.message,
      });
    }
  }
}

export default new CacheController();
