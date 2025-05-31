import { Transaction } from 'sequelize';
import { categoryRepository, courseCategoryRepository } from '../repositories';
import Category from '../models/category.model';
import Course from '../models/course.model';
import CourseCategory from '../models/course-category.model';
import { slugify, createUniqueSlug } from '../utils/slugify';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';
import cacheService from './cache.service';

interface CreateCategoryInput {
  name: string;
  description?: string;
  parent_id?: string | null;
  display_order?: number;
  is_active?: boolean;
}

interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parent_id?: string | null;
  display_order?: number;
  is_active?: boolean;
}

interface GetAllCategoriesOptions {
  page?: number;
  limit?: number;
  parent_id?: string | null;
  isActive?: boolean;
}

interface CourseCategoryInput {
  course_id: string;
  category_ids: string[]; // Support multiple category IDs
}

interface GetCoursesOptions {
  page?: number;
  limit?: number;
  include_subcategories?: boolean;
}

class CategoryService {
  /**
   * Initialize the categories table (for first-time setup)
   */
  async initCategoryTable(): Promise<void> {
    await Category.sync({ force: false });
  }

  /**
   * Initialize the course_categories junction table (for first-time setup)
   */
  async initCategoryCoursesTable(): Promise<void> {
    await CourseCategory.sync({ force: false });
    // Note: We can't use repository methods here since we're doing a table-level operation
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    const { name, description, parent_id, is_active = true } = data;

    // Convert empty string to null for parent_id
    const finalParentId = parent_id === '' ? null : parent_id;

    // Generate unique slug
    const existingCategories = await categoryRepository.findAll({
      attributes: ['slug'],
    });
    const existingSlugs = existingCategories.map(c => c.slug);
    const slug = createUniqueSlug(slugify(name), existingSlugs);

    // Validate parent if provided
    if (finalParentId) {
      const parent = await categoryRepository.findById(finalParentId);
      if (!parent) {
        throw new ApiError(400, 'Parent category does not exist');
      }
    }

    // Get next display order
    const display_order = await categoryRepository.getNextDisplayOrder(finalParentId);

    // Create category using repository
    const category = await categoryRepository.create({
      name,
      slug,
      description: description ?? null,
      parent_id: finalParentId,
      is_active,
      display_order,
    });

    // 🔥 Invalidate cache after creating category
    await cacheService.invalidateCategory(category.id, finalParentId);

    return category;
  }

  /**
   * Get a category by ID
   */
  async getCategoryById(id: string): Promise<Category> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCategoryById(id);
    if (cached) {
      return cached as Category;  
    }

    // Cache miss: get from database
    const category = await categoryRepository.findById(id);
    console.log('category', category);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // 💾 Store in cache for future requests
    await cacheService.setCategoryById(id, category, 3600); // 1 hour TTL

    return category;
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCategoryBySlug(slug);
    if (cached) {
      return cached as Category;
    }

    // Cache miss: get from database
    const category = await categoryRepository.findBySlug(slug);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // 💾 Store in cache for future requests
    await cacheService.setCategoryBySlug(slug, category, 3600); // 1 hour TTL
    // Also cache by ID for consistency
    await cacheService.setCategoryById(category.id, category, 3600);

    return category;
  }

  /**
   * Get all categories with optional pagination and filtering
   */
  async getAllCategories(
    options: GetAllCategoriesOptions = {}
  ): Promise<{ categories: Category[]; total: number }> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getAllCategories(options);
    if (cached) {
      return cached;
    }

    // Cache miss: get from database
    const result = await categoryRepository.findWithPagination(options);

    // 💾 Store in cache for future requests (30 minutes TTL for lists)
    await cacheService.setAllCategories(options, result, 1800);

    return result;
  }

  /**
   * Get category hierarchy (tree structure)
   */
  async getCategoryHierarchy(isActive: boolean = false): Promise<any[]> {
    console.log('Fetching all categories...', isActive);

    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCategoryHierarchy(isActive);
    if (cached) {
      return cached;
    }

    // Cache miss: get from database
    const hierarchy = await categoryRepository.getCategoryTree(isActive);

    // 💾 Store in cache for future requests (30 minutes TTL)
    await cacheService.setCategoryHierarchy(isActive, hierarchy, 1800);

    return hierarchy;
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, updateData: UpdateCategoryInput): Promise<Category> {
    console.log('UpdateDataAdmin', updateData);
    const category = await this.getCategoryById(id);

    let transaction: Transaction | null = null;

    try {
      transaction = await sequelize.transaction();

      // Validate parent_id if provided
      if (updateData.parent_id !== undefined) {
        // Prevent setting parent to itself
        if (String(updateData.parent_id) === id) {
          throw new ApiError(400, 'A category cannot be its own parent');
        }

        // Check if parent exists when parent_id is not null
        if (updateData.parent_id) {
          const parentExists = await categoryRepository.findById(updateData.parent_id);
          if (!parentExists) {
            throw new ApiError(400, 'Parent category does not exist');
          }

          // Prevent cyclic references
          await this.checkCyclicReference(id, updateData.parent_id);
        }

        // Get new display order for the category in its new position
        const newDisplayOrder = await categoryRepository.getNextDisplayOrder(updateData.parent_id);

        // Generate new slug if name is being updated
        let slug = category.slug;
        if (updateData.name) {
          slug = await this.generateUniqueSlug(updateData.name, category.slug);
        }

        // Update the category using repository
        await categoryRepository.updateById(
          id,
          {
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.name && { slug }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            parent_id: updateData.parent_id,
            display_order: newDisplayOrder,
            ...(updateData.is_active !== undefined && {
              is_active: updateData.is_active,
            }),
          },
          { transaction }
        );

        // Reorder siblings at the old parent level
        await this.reorderSiblings(category.parent_id, transaction);
      } else {
        // If parent_id is not being updated, just update other fields
        let slug = category.slug;
        if (updateData.name) {
          slug = await this.generateUniqueSlug(updateData.name, category.slug);
        }

        await categoryRepository.updateById(
          id,
          {
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.name && { slug }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            ...(updateData.is_active !== undefined && {
              is_active: updateData.is_active,
            }),
          },
          { transaction }
        );
      }

      await transaction.commit();
      transaction = null;

      // 🔥 Invalidate cache after updating category
      await cacheService.invalidateCategory(id, category.parent_id);

      return await this.getCategoryById(id);
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Helper function to check for cyclic references in category hierarchy
   */
  private async checkCyclicReference(categoryId: string, parentId: string | null): Promise<void> {
    let currentId: string | null = parentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      if (visited.has(currentId) || currentId === categoryId) {
        throw new ApiError(400, 'Cyclic reference detected in category hierarchy');
      }

      visited.add(currentId);

      const parent = await categoryRepository.findById(currentId, {
        attributes: ['parent_id'],
      });
      if (!parent) break;

      currentId = parent.parent_id;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);
    const parentId = category.parent_id; // Store parent_id before deletion

    let transaction: Transaction | null = null;

    try {
      transaction = await sequelize.transaction();

      // Update parent_id of child categories to null using repository
      const childCategories = await categoryRepository.findSubcategories(id);
      for (const child of childCategories) {
        await categoryRepository.updateById(child.id, { parent_id: null }, { transaction });
      }

      // Delete the category using repository
      await categoryRepository.deleteById(id, { transaction });

      // Reorder siblings after deletion
      await this.reorderSiblings(parentId, transaction);

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      // 🔥 Invalidate cache after deleting category
      await cacheService.invalidateCategory(id, parentId);
    } catch (error) {
      // Rollback in case of error
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Add default categories
   */
  async addDefaultCategories(): Promise<Category[]> {
    const defaultCategories = [
      {
        name: 'Programming',
        description: 'Learn programming languages and concepts',
      },
      {
        name: 'Data Science',
        description: 'Explore data analysis and machine learning',
      },
      {
        name: 'Web Development',
        description: 'Build websites and web applications',
      },
      {
        name: 'Mobile Development',
        description: 'Create apps for iOS and Android',
      },
      { name: 'DevOps', description: 'Learn about DevOps practices and tools' },
    ];

    const createdCategories: Category[] = [];

    for (const categoryData of defaultCategories) {
      try {
        // Check if category with same name already exists using repository
        const existingCategories = await categoryRepository.findAll({
          where: { name: categoryData.name },
        });

        if (existingCategories.length === 0) {
          // Create category if it doesn't exist
          const category = await this.createCategory({
            name: categoryData.name,
            description: categoryData.description,
          });
          createdCategories.push(category);
        }
      } catch (error) {
        console.error(`Failed to create default category ${categoryData.name}:`, error);
      }
    }

    return createdCategories;
  }

  /**
   * Associate a course with multiple categories
   */
  async associateCourseWithCategory(data: CourseCategoryInput): Promise<void> {
    const { course_id, category_ids } = data;

    if (!category_ids || category_ids.length === 0) {
      throw new ApiError(400, 'At least one category ID is required');
    }

    try {
      // Validate all categories exist
      for (const category_id of category_ids) {
        await this.getCategoryById(category_id);
      }

      // Associate course with all categories using repository
      for (const category_id of category_ids) {
        await courseCategoryRepository.associateCourseWithCategory(course_id, category_id);
      }

      // 🔥 Bulk invalidate course-category cache for all associations
      await cacheService.invalidateCourseCategoriesBulk(course_id, category_ids);

      console.log(`✅ Course ${course_id} associated with ${category_ids.length} categories`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove course-category associations for multiple categories
   */
  async disassociateCourseFromCategories(course_id: string, category_ids: string[]): Promise<void> {
    if (!category_ids || category_ids.length === 0) {
      throw new ApiError(400, 'At least one category ID is required');
    }

    let deletedCount = 0;

    try {
      // Remove associations for all categories
      for (const category_id of category_ids) {
        const deleted = await courseCategoryRepository.disassociateCourseFromCategory(
          course_id,
          category_id
        );
        deletedCount += deleted;
      }

      if (deletedCount === 0) {
        throw new ApiError(404, 'No course-category associations found');
      }

      // 🔥 Bulk invalidate course-category cache for all removed associations
      await cacheService.invalidateCourseCategoriesBulk(course_id, category_ids);

      console.log(`✅ Course ${course_id} disassociated from ${deletedCount} categories`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update course categories (replace all existing associations)
   */
  async updateCourseCategories(course_id: string, category_ids: string[]): Promise<void> {
    if (!category_ids || category_ids.length === 0) {
      throw new ApiError(400, 'At least one category ID is required');
    }

    try {
      // Validate all new categories exist
      for (const category_id of category_ids) {
        await this.getCategoryById(category_id);
      }

      // Get current associations
      const currentCategoryIds = await courseCategoryRepository.getCategoryIdsForCourse(course_id);

      // Remove all existing associations
      if (currentCategoryIds.length > 0) {
        for (const category_id of currentCategoryIds) {
          await courseCategoryRepository.disassociateCourseFromCategory(course_id, category_id);
        }
      }

      // Add new associations
      for (const category_id of category_ids) {
        await courseCategoryRepository.associateCourseWithCategory(course_id, category_id);
      }

      // 🔥 Bulk invalidate cache for all old and new associations
      const allAffectedCategories = [...new Set([...currentCategoryIds, ...category_ids])];

      await cacheService.invalidateCourseCategoriesBulk(course_id, allAffectedCategories);

      console.log(`✅ Course ${course_id} categories updated: ${category_ids.length} categories`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a course-category association (legacy method - kept for backward compatibility)
   */
  async disassociateCourseFromCategory(course_id: string, category_id: string): Promise<void> {
    await this.disassociateCourseFromCategories(course_id, [category_id]);
  }

  /**
   * Get all categories for a course
   */
  async getCategoriesForCourse(course_id: string): Promise<Category[]> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCategoriesForCourse(course_id);
    if (cached) {
      return cached;
    }

    // Cache miss: get from database
    // Use repository to get category IDs
    const categoryIds = await courseCategoryRepository.getCategoryIdsForCourse(course_id);

    if (categoryIds.length === 0) {
      // 💾 Cache empty result
      await cacheService.setCategoriesForCourse(course_id, [], 1800);
      return [];
    }

    // Get categories using those IDs
    const categories = await categoryRepository.findAll({
      where: {
        id: categoryIds,
      },
    });

    // 💾 Store in cache for future requests
    await cacheService.setCategoriesForCourse(course_id, categories, 1800);

    return categories;
  }

  /**
   * Get all courses for a category
   */
  async getCoursesForCategory(
    category_id: string,
    options: GetCoursesOptions = {}
  ): Promise<{ courses: any[]; total: number }> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCoursesForCategory(category_id, options);
    if (cached) {
      return cached;
    }

    // Cache miss: get from database
    // Use repository to get course IDs
    const courseIds = await courseCategoryRepository.getCourseIdsForCategory(category_id);

    if (courseIds.length === 0) {
      const emptyResult = { courses: [], total: 0 };
      // 💾 Cache empty result
      await cacheService.setCoursesForCategory(category_id, options, emptyResult, 1800);
      return emptyResult;
    }

    // Get courses using those IDs
    const courses = await Course.findAll({
      where: {
        id: courseIds,
      },
    });

    const result = { courses, total: courses.length };

    // 💾 Store in cache for future requests
    await cacheService.setCoursesForCategory(category_id, options, result, 1800);

    return result;
  }

  /**
   * Get category counts
   */
  async getCategoryCounts(): Promise<any[]> {
    // 🎯 Cache-Aside: Check cache first
    const cached = await cacheService.getCategoryCounts();
    if (cached) {
      return cached;
    }

    // Cache miss: get from database
    const counts = await categoryRepository.findWithCourseCount();

    // 💾 Store in cache for future requests
    await cacheService.setCategoryCounts(counts, 1800);

    return counts;
  }

  /**
   * Generate unique slug
   */
  private async generateUniqueSlug(name: string, currentSlug: string): Promise<string> {
    const newSlug = slugify(name);

    // If the new slug is the same as current, keep it
    if (newSlug === currentSlug) {
      return currentSlug;
    }

    // Check if the new slug is unique
    const isUnique = await categoryRepository.isSlugUnique(newSlug);
    if (isUnique) {
      return newSlug;
    }

    // Generate unique slug with suffix
    const existingCategories = await categoryRepository.findAll({
      attributes: ['slug'],
    });
    const existingSlugs = existingCategories.map(c => c.slug);

    return createUniqueSlug(newSlug, existingSlugs);
  }

  /**
   * Reorder siblings after category changes
   */
  private async reorderSiblings(parentId: string | null, transaction: Transaction): Promise<void> {
    await categoryRepository.reorderCategories(parentId, 0, transaction);
  }

  /**
   * Cache management methods
   */

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    return await cacheService.getCacheStats();
  }

  /**
   * Clear all category cache
   */
  async clearCategoryCache(): Promise<void> {
    await cacheService.clearAllCategoryCache();
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up category cache...');

    try {
      // Pre-load frequently accessed data
      await Promise.all([
        // Load category hierarchy (both active and all)
        this.getCategoryHierarchy(true),
        this.getCategoryHierarchy(false),

        // Load category counts
        this.getCategoryCounts(),

        // Load first page of categories
        this.getAllCategories({ page: 1, limit: 20 }),
      ]);

      console.log('✅ Category cache warmed up successfully');
    } catch (error) {
      console.error('❌ Error warming up category cache:', error);
    }
  }
}

export default new CategoryService();
