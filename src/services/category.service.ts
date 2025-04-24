import Category from "../models/category.model";
import CourseCategory from "../models/course-category.model";
import { slugify, createUniqueSlug } from "../utils/slugify";
import { ApiError } from "../utils/api-error";
import { Op } from "sequelize";
import sequelize from "../config/database";

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

    /* 0️⃣  Chuyển 0 => null */
    const finalParentId = parent_id == "" ? null : parent_id; // null nếu không có cha

    /* 1. slug */
    const slug = createUniqueSlug(
      slugify(name),
      (await Category.findAll({ attributes: ["slug"] })).map((c) => c.slug)
    );

    /* 2. validate parent */
    if (finalParentId) {
      const parent = await Category.findByPk(finalParentId);
      if (!parent) throw new ApiError(400, "Parent category does not exist");
    }

    /* 3. display_order */
    const siblings = await Category.findAll({
      where: { parent_id: finalParentId },
      attributes: ["display_order"],
      order: [["display_order", "DESC"]],
    });
    const display_order = siblings.length ? siblings[0].display_order + 1 : 0;

    /* 4. tạo */
    return Category.create({
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
    const category = await Category.findByPk(id);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }
    return category;
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category> {
    const category = await Category.findOne({ where: { slug } });
    if (!category) {
      throw new ApiError(404, "Category not found");
    }
    return category;
  }

  /**
   * Get all categories with optional pagination and filtering
   */
  async getAllCategories(
    options: GetAllCategoriesOptions = {}
  ): Promise<{ categories: Category[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      parent_id,
      includeInactive = false,
    } = options;
    const offset = (page - 1) * limit;

    // Build the where clause
    const whereClause: any = {};

    whereClause.is_active = includeInactive;

    // Filter by parent_id if provided
    if (parent_id !== undefined) {
      whereClause.parent_id = parent_id === null ? null : parent_id;
    }

    // Get total count
    const total = await Category.count({ where: whereClause });

    // Get categories with pagination
    const categories = await Category.findAll({
      where: whereClause,
      limit,
      offset,
      order: [
        ["display_order", "ASC"],
        ["name", "ASC"],
      ],
    });

    return { categories, total };
  }

  /**
   * Get category hierarchy (tree structure)
   */
  async getCategoryHierarchy(includeInactive: boolean = false): Promise<any[]> {
    // Get all categories
    console.log("Fetching all categories...", includeInactive);
    const whereClause = includeInactive
      ? { is_active: true }
      : {
          is_active: false,
        };
    const allCategories = await Category.findAll({
      where: whereClause,
      order: [
        ["display_order", "ASC"],
        ["name", "ASC"],
      ],
    });

    // Convert to a map for faster lookups
    const categoryMap = new Map<string, any>(); // Thay đổi từ number sang string
    allCategories.forEach((category) => {
      categoryMap.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        display_order: category.display_order,
        is_active: category.is_active,
        children: [],
      });
    });

    // Build the tree structure
    const rootCategories: any[] = [];

    allCategories.forEach((category) => {
      if (category.parent_id === null) {
        // This is a root category
        rootCategories.push(categoryMap.get(category.id));
      } else {
        // This is a child category
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryMap.get(category.id));
        }
      }
    });

    return rootCategories;
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    updateData: UpdateCategoryInput
  ): Promise<Category> {
    console.log("UpdateDataAdmin", updateData);
    const category = await this.getCategoryById(id);
    const transaction = await sequelize.transaction();
    try {
      // Validate parent_id if provided
      if (updateData.parent_id) {
        // Prevent setting parent to itself
        if (String(updateData.parent_id) === id) {
          throw new ApiError(400, "A category cannot be its own parent");
        }

        // Check if parent exists when parent_id is not null
        if (updateData.parent_id !== null) {
          const parentExists = await Category.findByPk(updateData.parent_id);
          if (!parentExists) {
            throw new ApiError(400, "Parent category does not exist");
          }

          // Prevent cyclic references
          await this.checkCyclicReference(id, updateData.parent_id);
        }

        // Get current siblings at the new parent level
        const siblings = await Category.findAll({
          where: {
            parent_id: updateData.parent_id,
            id: { [Op.ne]: id }, // Exclude current category
          },
          order: [["display_order", "ASC"]],
          transaction,
        });

        // Recalculate display_order for the category in its new position
        const newDisplayOrder = siblings.length;

        // Update the category with new parent_id and display_order
        await category.update(
          {
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.name && {
              slug: await this.generateUniqueSlug(
                updateData.name,
                category.slug
              ),
            }),
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
      } else if (!updateData.parent_id) {
        const siblings = await Category.findAll({
          where: {
            parent_id: null,
            id: { [Op.ne]: id }, // Exclude current category
          },
          order: [["display_order", "ASC"]],
          transaction,
        });

        const newDisplayOrder = siblings.length;

        // If parent_id is not being updated, just update other fields
        await category.update(
          {
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.name && {
              slug: await this.generateUniqueSlug(
                updateData.name,
                category.slug
              ),
            }),
            ...(updateData.description !== undefined && {
              description: updateData.description,
            }),
            ...(updateData.is_active !== undefined && {
              is_active: updateData.is_active,
            }),
            parent_id: null,
            display_order: newDisplayOrder,
          },
          { transaction }
        );

        // Reorder siblings at the old parent level
        await this.reorderSiblings(category.parent_id, transaction);
      }

      await transaction.commit();
      return category;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Helper function to check for cyclic references in category hierarchy
   */
  private async checkCyclicReference(
    categoryId: string,
    parentId: string | null
  ): Promise<void> {
    let currentId: string | null = parentId;
    const visited = new Set<string>();

    while (currentId !== null) {
      /* vòng lặp an toàn */
      if (visited.has(currentId) || currentId === categoryId) {
        throw new ApiError(
          400,
          "Cyclic reference detected in category hierarchy"
        );
      }

      visited.add(currentId);

      const parent = await Category.findByPk(currentId, {
        attributes: ["parent_id"],
      });
      if (!parent) break;

      // parent.parent_id đã là string | null trong model
      currentId = parent.parent_id;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);
    const parentId = category.parent_id; // Store parent_id before deletion

    const transaction = await sequelize.transaction();

    try {
      // Update parent_id of child categories to null
      await Category.update(
        { parent_id: null },
        {
          where: { parent_id: id },
          transaction,
        }
      );

      // Delete the category
      await category.destroy({ transaction });

      // Reorder siblings after deletion
      const siblings = await Category.findAll({
        where: { parent_id: parentId },
        order: [["display_order", "ASC"]],
        transaction,
      });

      // Update display_order for all remaining siblings
      for (let i = 0; i < siblings.length; i++) {
        await siblings[i].update({ display_order: i }, { transaction });
      }

      // Commit the transaction
      await transaction.commit();
    } catch (error) {
      // Rollback in case of error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add default categories
   */
  async addDefaultCategories(): Promise<Category[]> {
    const defaultCategories = [
      {
        name: "Programming",
        description: "Learn programming languages and concepts",
      },
      {
        name: "Data Science",
        description: "Explore data analysis and machine learning",
      },
      {
        name: "Web Development",
        description: "Build websites and web applications",
      },
      {
        name: "Mobile Development",
        description: "Create apps for iOS and Android",
      },
      { name: "DevOps", description: "Learn about DevOps practices and tools" },
    ];

    const createdCategories: Category[] = [];

    for (const categoryData of defaultCategories) {
      try {
        // Check if category with same name already exists
        const existingCategory = await Category.findOne({
          where: { name: categoryData.name },
        });

        if (!existingCategory) {
          // Create category if it doesn't exist
          const category = await this.createCategory({
            name: categoryData.name,
            description: categoryData.description,
          });
          createdCategories.push(category);
        }
      } catch (error) {
        console.error(
          `Failed to create default category ${categoryData.name}:`,
          error
        );
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
  async disassociateCourseFromCategory(
    course_id: string,
    category_id: string
  ): Promise<void> {
    const deleted = await CourseCategory.destroy({
      where: { course_id, category_id },
    });

    if (deleted === 0) {
      throw new ApiError(404, "Course-category association not found");
    }
  }

  /**
   * Get all categories for a course
   */
  async getCategoriesForCourse(course_id: string): Promise<Category[]> {
    const categories = await Category.findAll({
      include: [
        {
          model: CourseCategory,
          as: "course_categories",
          where: { course_id },
          attributes: [],
        },
      ],
    });

    return categories;
  }

  /**
   * Get all courses for a category
   */
  async getCoursesForCategory(
    category_id: string,
    options: GetCoursesOptions = {}
  ): Promise<{ courses: any[]; total: number }> {
    const { page = 1, limit = 10, include_subcategories = false } = options;
    const offset = (page - 1) * limit;

    // Import Course model here to avoid circular dependencies
    const Course = require("../models/course.model").default;
    const User = require("../models/user.model").default;

    let categoryIds = [category_id];

    // If include_subcategories is true, get all subcategories
    if (include_subcategories) {
      const subcategories = await Category.findAll({
        where: { parent_id: category_id },
        attributes: ["id"],
      });
      categoryIds = [...categoryIds, ...subcategories.map((c) => c.id)];
    }

    // Get courses for the category and its subcategories if requested
    const { count, rows } = await Course.findAndCountAll({
      include: [
        {
          model: Category,
          as: "categories",
          through: { attributes: [] },
          where: { id: { [Op.in]: categoryIds } },
        },
        {
          model: User,
          as: "instructor",
          attributes: ["id", "name", "email", "profile_thumbnail"],
        },
      ],
      where: {
        is_published: true,
        is_approved: true,
      },
      limit,
      offset,
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    return { courses: rows, total: count };
  }

  /**
   * Get count of courses in each category
   */
  async getCategoryCounts(): Promise<any[]> {
    // Import CourseCategory model here to avoid circular dependencies
    const CourseCategory = require("../models/course-category.model").default;

    // Get all categories
    const categories = await Category.findAll({
      where: { is_active: true },
      attributes: ["id", "name", "slug"],
      order: [["name", "ASC"]],
    });

    // Get course counts for each category
    const counts = await Promise.all(
      categories.map(async (category) => {
        const count = await CourseCategory.count({
          where: { category_id: category.id },
        });

        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          count,
        };
      })
    );

    return counts;
  }

  // Helper method to generate unique slug
  private async generateUniqueSlug(
    name: string,
    currentSlug: string
  ): Promise<string> {
    const baseSlug = slugify(name);
    const existingSlugs = (
      await Category.findAll({
        where: { slug: { [Op.ne]: currentSlug } },
        attributes: ["slug"],
      })
    ).map((c) => c.slug);
    return createUniqueSlug(baseSlug, existingSlugs);
  }

  // Helper method to reorder siblings
  private async reorderSiblings(
    parentId: string | null,
    transaction: any
  ): Promise<void> {
    const siblings = await Category.findAll({
      where: { parent_id: parentId },
      order: [["display_order", "ASC"]],
      transaction,
    });

    // Update display_order for all siblings
    for (let i = 0; i < siblings.length; i++) {
      await siblings[i].update({ display_order: i }, { transaction });
    }
  }
}

export default new CategoryService();
