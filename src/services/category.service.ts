import { Transaction } from 'sequelize';
import { categoryRepository } from '../repositories';
import Category from '../models/category.model';
import CourseCategory from '../models/course-category.model';
import { slugify, createUniqueSlug } from '../utils/slugify';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

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
  includeInactive?: boolean;
}

interface CourseCategoryInput {
  course_id: string;
  category_id: string;
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
    return await categoryRepository.create({
      name,
      slug,
      description: description ?? null,
      parent_id: finalParentId,
      is_active,
      display_order,
    });
  }

  /**
   * Get a category by ID
   */
  async getCategoryById(id: string): Promise<Category> {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    return category;
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category> {
    const category = await categoryRepository.findBySlug(slug);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    return category;
  }

  /**
   * Get all categories with optional pagination and filtering
   */
  async getAllCategories(
    options: GetAllCategoriesOptions = {}
  ): Promise<{ categories: Category[]; total: number }> {
    return await categoryRepository.findWithPagination(options);
  }

  /**
   * Get category hierarchy (tree structure)
   */
  async getCategoryHierarchy(includeInactive: boolean = false): Promise<any[]> {
    console.log('Fetching all categories...', includeInactive);

    return await categoryRepository.getCategoryTree();
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
        if (updateData.parent_id !== null) {
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
   * Associate a course with a category
   */
  async associateCourseWithCategory(data: CourseCategoryInput): Promise<void> {
    const { course_id, category_id } = data;

    // Check if the category exists
    await this.getCategoryById(category_id);

    // Create or update the association
    await CourseCategory.upsert({
      course_id,
      category_id,
    });
  }

  /**
   * Remove a course-category association
   */
  async disassociateCourseFromCategory(course_id: string, category_id: string): Promise<void> {
    const deleted = await CourseCategory.destroy({
      where: { course_id, category_id },
    });

    if (deleted === 0) {
      throw new ApiError(404, 'Course-category association not found');
    }
  }

  /**
   * Get all categories for a course
   */
  async getCategoriesForCourse(course_id: string): Promise<Category[]> {
    return await categoryRepository.findAll({
      include: [
        {
          model: CourseCategory,
          as: 'course_categories',
          where: { course_id },
          attributes: [],
        },
      ],
    });
  }

  /**
   * Get all courses for a category
   */
  async getCoursesForCategory(
    category_id: string,
    options: GetCoursesOptions = {}
  ): Promise<{ courses: any[]; total: number }> {
    // This would need to be implemented in the repository
    // For now, return empty result
    return { courses: [], total: 0 };
  }

  /**
   * Get category counts
   */
  async getCategoryCounts(): Promise<any[]> {
    return await categoryRepository.findWithCourseCount();
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
}

export default new CategoryService();
