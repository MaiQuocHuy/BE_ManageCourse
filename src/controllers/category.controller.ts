import { Request, Response, NextFunction } from 'express';
import categoryService from '../services/category.service';

class CategoryController {
  /**
   * Initialize the categories and course_categories tables
   */
  async initTables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await categoryService.initCategoryTable();
      await categoryService.initCategoryCoursesTable();

      res.status(200).json({
        success: true,
        message: 'Category tables initialized successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new category
   */
  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, parent_id } = req.body;

      const category = await categoryService.createCategory({
        name,
        description,
        parent_id,
      });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a category by ID
   */
  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const category = await categoryService.getCategoryById(id);

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params.slug;
      const category = await categoryService.getCategoryBySlug(slug);

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all categories with pagination and filtering
   */
  async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      // Handle parent_id filtering
      let parent_id: string | null | undefined = undefined;
      if (req.query.parent_id !== undefined) {
        parent_id = req.query.parent_id === 'null' ? null : (req.query.parent_id as string);
      }

      // Handle includeInactive parameter
      const isActive = req.query.isActive === 'true';

      const result = await categoryService.getAllCategories({
        page,
        limit,
        parent_id,
        isActive,
      });

      res.status(200).json({
        success: true,
        data: result.categories,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category hierarchy as a tree structure
   */
  async getCategoryHierarchy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.query.isActive === 'true';
      const hierarchy = await categoryService.getCategoryHierarchy(isActive);

      res.status(200).json({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a category
   */
  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, parent_id, is_active } = req.body;
      const category = await categoryService.updateCategory(id, {
        name,
        description,
        parent_id,
        is_active,
      });

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      await categoryService.deleteCategory(id);

      res.status(200).json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add default categories
   */
  async addDefaultCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await categoryService.addDefaultCategories();

      res.status(200).json({
        success: true,
        message: 'Default categories added successfully',
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Associate a course with a category
   */
  async associateCourseWithCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const { category_id } = req.body;

      await categoryService.associateCourseWithCategory({
        course_id,
        category_id,
      });

      res.status(200).json({
        success: true,
        message: 'Course associated with category successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disassociate a course from a category
   */
  async disassociateCourseFromCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const { category_id } = req.body;

      await categoryService.disassociateCourseFromCategory(course_id, category_id);

      res.status(200).json({
        success: true,
        message: 'Course disassociated from category successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get categories for a course
   */
  async getCategoriesForCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const course_id = req.params.courseId;
      const categories = await categoryService.getCategoriesForCourse(course_id);

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get courses for a category
   */
  async getCoursesForCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category_id = req.params.categoryId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const include_subcategories = req.query.include_subcategories === 'true';

      const result = await categoryService.getCoursesForCategory(category_id, {
        page,
        limit,
        include_subcategories,
      });

      res.status(200).json({
        success: true,
        data: result.courses,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get counts of courses in each category
   */
  async getCategoryCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await categoryService.getCategoryCounts();

      res.status(200).json({
        success: true,
        data: counts,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CategoryController();
