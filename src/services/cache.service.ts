import RedisClient from '../config/redis';
import { Redis } from 'ioredis';
import Category from '../models/category.model';

interface CacheOptions {
  ttl?: number; // Time To Live in seconds
  compress?: boolean;
}

interface CategoryCacheKeys {
  category: (id: string) => string;
  categorySlug: (slug: string) => string;
  allCategories: (options?: any) => string;
  categoryHierarchy: (isActive?: boolean) => string;
  categoryCounts: () => string;
  categoriesForCourse: (courseId: string) => string;
  coursesForCategory: (categoryId: string, options?: any) => string;
  categoryPattern: () => string;
}

class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour default TTL
  private isRedisAvailable: boolean = true;

  // Cache key patterns for categories
  private keys: CategoryCacheKeys = {
    category: (id: string) => `category:${id}`,
    categorySlug: (slug: string) => `category:slug:${slug}`,
    allCategories: (options?: any) => {
      const { page = 1, limit = 10, parent_id, isActive } = options || {};
      return `categories:list:p${page}:l${limit}:pid${parent_id || 'null'}:active${isActive || 'all'}`;
    },
    categoryHierarchy: (isActive = false) => `categories:hierarchy:active${isActive}`,
    categoryCounts: () => 'categories:counts',
    categoriesForCourse: (courseId: string) => `course:${courseId}:categories`,
    coursesForCategory: (categoryId: string, options?: any) => {
      const { page = 1, limit = 10, include_subcategories = false } = options || {};
      return `category:${categoryId}:courses:p${page}:l${limit}:sub${include_subcategories}`;
    },
    categoryPattern: () => 'category*',
  };

  constructor() {
    this.redis = RedisClient.getInstance();
    this.checkRedisAvailability();
  }

  /**
   * Check if Redis is available
   */
  private async checkRedisAvailability(): Promise<void> {
    try {
      await this.redis.ping();
      this.isRedisAvailable = true;
    } catch (error) {
      console.warn('⚠️ Redis not available, falling back to database only');
      this.isRedisAvailable = false;
    }
  }

  /**
   * Generic cache get method (Cache-Aside pattern)
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isRedisAvailable) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        console.log(`🎯 Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.isRedisAvailable = false;
      return null;
    }
  }

  /**
   * Generic cache set method with TTL
   */
  async set(key: string, data: any, options: CacheOptions = {}): Promise<void> {
    if (!this.isRedisAvailable) {
      return;
    }

    try {
      const ttl = options.ttl || this.defaultTTL;
      const serialized = JSON.stringify(data);

      await this.redis.setex(key, ttl, serialized);
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Delete specific cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.isRedisAvailable) {
      return;
    }

    try {
      await this.redis.del(key);
      console.log(`🗑️ Cache DELETE: ${key}`);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple cache keys by pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isRedisAvailable) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Cache invalidation strategy for write operations
   */
  async invalidateCategory(categoryId?: string, parentId?: string | null): Promise<void> {
    if (!this.isRedisAvailable) {
      return;
    }

    try {
      const keysToDelete: string[] = [];

      // Always invalidate global caches
      keysToDelete.push(
        this.keys.categoryHierarchy(true),
        this.keys.categoryHierarchy(false),
        this.keys.categoryCounts()
      );

      // Invalidate specific category cache
      if (categoryId) {
        keysToDelete.push(this.keys.category(categoryId));
      }

      // Invalidate all categories lists (different pagination/filter combinations)
      await this.deletePattern('categories:list:*');

      // Invalidate course-category associations
      await this.deletePattern('course:*:categories');
      await this.deletePattern('category:*:courses:*');

      // Delete specific keys
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }

      console.log(`🔥 Cache INVALIDATED for category operations`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Cache invalidation for course-category associations
   */
  async invalidateCourseCategory(courseId: string, categoryId: string): Promise<void> {
    if (!this.isRedisAvailable) {
      return;
    }

    try {
      const keysToDelete = [this.keys.categoriesForCourse(courseId), this.keys.categoryCounts()];

      // Invalidate all courses for this category (different pagination combinations)
      await this.deletePattern(`category:${categoryId}:courses:*`);

      await this.redis.del(...keysToDelete);
      console.log(`🔥 Cache INVALIDATED for course-category association`);
    } catch (error) {
      console.error('Cache invalidation error for course-category:', error);
    }
  }

  /**
   * Bulk cache invalidation for multiple course-category associations
   */
  async invalidateCourseCategoriesBulk(courseId: string, categoryIds: string[]): Promise<void> {
    if (!this.isRedisAvailable || categoryIds.length === 0) {
      return;
    }

    try {
      const keysToDelete = [this.keys.categoriesForCourse(courseId), this.keys.categoryCounts()];

      // Invalidate all courses for all categories (different pagination combinations)
      for (const categoryId of categoryIds) {
        await this.deletePattern(`category:${categoryId}:courses:*`);
      }

      await this.redis.del(...keysToDelete);
      console.log(`🔥 Cache INVALIDATED for ${categoryIds.length} course-category associations`);
    } catch (error) {
      console.error('Cache invalidation error for bulk course-category:', error);
    }
  }

  /**
   * Category-specific cache methods
   */

  // Cache category by ID
  async getCategoryById(id: string) {
    return await this.get(this.keys.category(id));
  }

  async setCategoryById(id: string, data: any, ttl: number = 3600) {
    await this.set(this.keys.category(id), data, { ttl });
  }

  // Cache category by slug
  async getCategoryBySlug(slug: string) {
    return await this.get(this.keys.categorySlug(slug));
  }

  async setCategoryBySlug(slug: string, data: any, ttl: number = 3600) {
    await this.set(this.keys.categorySlug(slug), data, { ttl });
  }

  // Cache categories list
  async getAllCategories(options: any): Promise<{ categories: Category[]; total: number } | null> {
    return await this.get(this.keys.allCategories(options));
  }

  async setAllCategories(options: any, data: any, ttl: number = 1800) {
    await this.set(this.keys.allCategories(options), data, { ttl });
  }

  // Cache category hierarchy
  async getCategoryHierarchy(isActive: boolean = false): Promise<any[] | null> {
    return await this.get(this.keys.categoryHierarchy(isActive));
  }

  async setCategoryHierarchy(isActive: boolean, data: any, ttl: number = 1800) {
    await this.set(this.keys.categoryHierarchy(isActive), data, { ttl });
  }

  // Cache category counts
  async getCategoryCounts(): Promise<any[] | null> {
    return await this.get(this.keys.categoryCounts());
  }

  async setCategoryCounts(data: any, ttl: number = 1800) {
    await this.set(this.keys.categoryCounts(), data, { ttl });
  }

  // Cache categories for course
  async getCategoriesForCourse(courseId: string): Promise<any[] | null> {
    return await this.get(this.keys.categoriesForCourse(courseId));
  }

  async setCategoriesForCourse(courseId: string, data: any, ttl: number = 3600) {
    await this.set(this.keys.categoriesForCourse(courseId), data, { ttl });
  }

  // Cache courses for category
  async getCoursesForCategory(
    categoryId: string,
    options: any
  ): Promise<{ courses: any[]; total: number } | null> {
    return await this.get(this.keys.coursesForCategory(categoryId, options));
  }

  async setCoursesForCategory(categoryId: string, options: any, data: any, ttl: number = 1800) {
    await this.set(this.keys.coursesForCategory(categoryId, options), data, { ttl });
  }

  /**
   * Utility methods
   */

  // Clear all category caches
  async clearAllCategoryCache(): Promise<void> {
    await this.deletePattern(this.keys.categoryPattern());
  }

  // Get cache statistics
  async getCacheStats(): Promise<any> {
    if (!this.isRedisAvailable) {
      return { available: false };
    }

    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      const categoryKeys = await this.redis.keys(this.keys.categoryPattern());

      return {
        available: true,
        totalKeys: keyCount,
        categoryKeys: categoryKeys.length,
        memoryInfo: info,
      };
    } catch (error: any) {
      console.error('Error getting cache stats:', error);
      return { available: false, error: error?.message || 'Unknown error' };
    }
  }

  // Warm up cache with frequently accessed data
  async warmUpCache(): Promise<void> {
    console.log('🔥 Starting cache warm-up...');
    // This will be called by the category service to pre-populate frequently accessed data
  }
}

export default new CacheService();
