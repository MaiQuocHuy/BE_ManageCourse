import { Op, FindOptions, Transaction, where } from 'sequelize';
import Category from '../models/category.model';
import Course from '../models/course.model';
import { BaseRepository } from './base.repository';

interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  parent_id?: string | null;
  isActive?: boolean;
}

export class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super(Category);
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string, options?: FindOptions): Promise<Category | null> {
    return await this.findOne({
      where: { slug },
      ...options,
    });
  }

  /**
   * Find root categories (no parent)
   */
  async findRootCategories(options?: FindOptions): Promise<Category[]> {
    return await this.findAll({
      where: { parent_id: null },
      order: [['display_order', 'ASC']],
      ...options,
    });
  }

  /**
   * Find categories with subcategories
   */
  async findWithSubcategories(options?: FindOptions): Promise<Category[]> {
    return await this.findAll({
      where: { parent_id: null },
      include: [
        {
          model: Category,
          as: 'children',
          order: [['display_order', 'ASC']],
        },
      ],
      order: [['display_order', 'ASC']],
      ...options,
    });
  }

  /**
   * Find subcategories by parent ID
   */
  async findSubcategories(parent_id: string, options?: FindOptions): Promise<Category[]> {
    return await this.findAll({
      where: { parent_id },
      order: [['display_order', 'ASC']],
      ...options,
    });
  }

  /**
   * Find categories with pagination and search
   */
  async findWithPagination(
    options: PaginationOptions = {}
  ): Promise<{ categories: Category[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, parent_id, isActive = false } = options;
    const offset = (page - 1) * limit;

    let whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    if (parent_id !== undefined) {
      whereClause.parent_id = parent_id;
    }

    whereClause.is_active = isActive ? true : false;

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      limit,
      offset,
      order: [['display_order', 'ASC']],
    });

    return {
      categories: rows,
      total: count,
      page,
      limit,
    };
  }

  /**
   * Find categories with course count
   */
  async findWithCourseCount(options?: FindOptions): Promise<any[]> {
    return await this.findAll({
      include: [
        {
          model: Course,
          as: 'courses',
          attributes: [],
          through: { attributes: [] },
        },
      ],
      attributes: {
        include: [
          [Category.sequelize!.fn('COUNT', Category.sequelize!.col('courses.id')), 'course_count'],
        ],
      },
      group: ['Category.id'],
      order: [['display_order', 'ASC']],
      ...options,
    });
  }

  /**
   * Find popular categories (by course count)
   */
  async findPopularCategories(limit: number = 10): Promise<any[]> {
    return await this.findAll({
      include: [
        {
          model: Course,
          as: 'courses',
          attributes: [],
          through: { attributes: [] },
          where: {
            is_published: true,
            is_approved: true,
          },
        },
      ],
      attributes: {
        include: [
          [Category.sequelize!.fn('COUNT', Category.sequelize!.col('courses.id')), 'course_count'],
        ],
      },
      group: ['Category.id'],
      order: [[Category.sequelize!.literal('course_count'), 'DESC']],
      limit,
    });
  }

  /**
   * Check if slug is unique (excluding specific category)
   */
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    let whereClause: any = { slug };

    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    return !(await this.exists(whereClause));
  }

  /**
   * Get next display order for a parent category
   */
  async getNextDisplayOrder(parent_id?: string | null): Promise<number> {
    const whereClause = parent_id ? { parent_id } : { parent_id: null };

    const maxOrderCategory = await this.findOne({
      where: whereClause,
      attributes: ['display_order'],
      order: [['display_order', 'DESC']],
    });

    return maxOrderCategory ? maxOrderCategory.display_order + 1 : 1;
  }

  /**
   * Update category order
   */
  async updateOrder(
    id: string,
    display_order: number,
    transaction?: Transaction
  ): Promise<Category | null> {
    return await this.updateById(id, { display_order }, { transaction });
  }

  /**
   * Move category up/down
   */
  async moveCategoryOrder(
    id: string,
    direction: 'up' | 'down',
    transaction?: Transaction
  ): Promise<boolean> {
    const category = await this.findById(id, { transaction });
    if (!category) return false;

    const currentOrder = category.display_order;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    // Find the category to swap with (same parent level)
    const targetCategory = await this.findOne({
      where: {
        parent_id: category.parent_id,
        display_order: targetOrder,
      },
      transaction,
    });

    if (!targetCategory) return false;

    // Swap order indexes
    await this.updateById(category.id, { display_order: targetOrder }, { transaction });
    await this.updateById(targetCategory.id, { display_order: currentOrder }, { transaction });

    return true;
  }

  /**
   * Reorder categories after deletion
   */
  async reorderCategories(
    parent_id: string | null,
    deletedDisplayOrder: number,
    transaction?: Transaction
  ): Promise<void> {
    const whereClause = parent_id ? { parent_id } : { parent_id: null };

    await Category.update(
      { display_order: Category.sequelize!.literal('display_order - 1') },
      {
        where: {
          ...whereClause,
          display_order: { [Op.gt]: deletedDisplayOrder },
        },
        transaction,
      }
    );
  }

  /**
   * Get category hierarchy (breadcrumb)
   */
  async getCategoryHierarchy(category_id: string): Promise<Category[]> {
    const hierarchy: Category[] = [];
    let currentCategory = await this.findById(category_id);

    while (currentCategory) {
      hierarchy.unshift(currentCategory);

      if (currentCategory.parent_id) {
        currentCategory = await this.findById(currentCategory.parent_id);
      } else {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Check if category has subcategories
   */
  async hasSubcategories(category_id: string): Promise<boolean> {
    return await this.exists({ parent_id: category_id });
  }

  /**
   * Check if category has courses
   */
  async hasCourses(category_id: string): Promise<boolean> {
    const categoryWithCourses = await this.findById(category_id, {
      include: [
        {
          model: Course,
          as: 'courses',
          attributes: ['id'],
          through: { attributes: [] },
          limit: 1,
        },
      ],
    });

    return !!(categoryWithCourses && (categoryWithCourses.get('courses') as Course[]).length > 0);
  }

  /**
   * Get category tree structure
   */
  async getCategoryTree(isActive: boolean = false): Promise<any[]> {
    // Create where clause based on isActive
    const whereClause: any = { parent_id: null };

    whereClause.is_active = isActive ? true : false;

    // Create include options for children
    const childrenInclude: any = {
      model: Category,
      as: 'children',
      required: false,
      order: [['display_order', 'ASC']],
    };

    // Get root categories with filtered subcategories
    const rootCategories = await this.findAll({
      where: whereClause,
      include: [childrenInclude],
      order: [['display_order', 'ASC']],
    });

    const buildTree = (categories: Category[]): any[] => {
      return categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        is_active: Boolean(category.is_active),
        display_order: category.display_order,
        children: category.get('children') ? buildTree(category.get('children') as Category[]) : [],
      }));
    };

    return buildTree(rootCategories);
  }

  /**
   * Search categories and subcategories
   */
  async searchCategories(searchTerm: string, limit: number = 20): Promise<Category[]> {
    return await this.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${searchTerm}%` } },
          { description: { [Op.like]: `%${searchTerm}%` } },
        ],
      },
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      limit,
      order: [['name', 'ASC']],
    });
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<{
    totalCategories: number;
    rootCategories: number;
    subcategories: number;
  }> {
    const [totalCategories, rootCategories] = await Promise.all([
      this.count(),
      this.count({ where: { parent_id: null } }),
    ]);

    const subcategories = totalCategories - rootCategories;

    return {
      totalCategories,
      rootCategories,
      subcategories,
    };
  }
}

export default new CategoryRepository();
