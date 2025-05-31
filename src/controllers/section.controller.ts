import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/user-role.model';
import { ApiError } from '../utils/api-error';
import sectionService from '../services/section.service';
class SectionController {
  /**
   * Initialize section table
   */
  async initSectionTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await sectionService.initSectionTable();

      res.status(200).json({
        success: true,
        message: 'Section table initialized successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new section
   */
  async createSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { course_id, title, description, order_index = null } = req.body;
      const user_id = req.user!.id;

      const section = await sectionService.createSection(
        {
          course_id,
          title,
          description,
          order_index,
        },
        user_id
      );

      res.status(201).json({
        success: true,
        data: section,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a section by ID
   */
  async getSectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some((role: any) => role.role === Role.ADMIN);

      // Check if user has access to this section
      await sectionService.checkSectionAccess(id, user_id, isAdmin);

      const section = await sectionService.getSectionById(id);

      res.status(200).json({
        success: true,
        data: section,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all sections for a course
   */
  async getCourseSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const course_id = req.params.courseId;

      // TODO: Check if user has access to this course
      const sections = await sectionService.getCourseSections(course_id);

      res.status(200).json({
        success: true,
        data: sections,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a section
   */
  async updateSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const { title, description } = req.body;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some((role: any) => role.role === Role.ADMIN);

      const section = await sectionService.updateSection(
        id,
        {
          title,
          description,
        },
        user_id,
        isAdmin
      );

      res.status(200).json({
        success: true,
        data: section,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a section
   */
  async deleteSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some((role: any) => role.role === Role.ADMIN);

      await sectionService.deleteSection(id, user_id, isAdmin);

      res.status(200).json({
        success: true,
        message: 'Section deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder sections in a course
   */
  async reorderSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { course_id, section_ids, order_indices } = req.body;

      // Validate required fields
      if (!course_id) {
        return next(new ApiError(400, 'course_id is required'));
      }

      if (!section_ids || !Array.isArray(section_ids) || section_ids.length === 0) {
        return next(new ApiError(400, 'section_ids must be a non-empty array'));
      }

      if (!order_indices || !Array.isArray(order_indices) || order_indices.length === 0) {
        return next(new ApiError(400, 'order_indices must be a non-empty array'));
      }

      if (section_ids.length !== order_indices.length) {
        return next(
          new ApiError(400, 'section_ids and order_indices arrays must have the same length')
        );
      }

      const user_id = req.user!.id;
      const isAdmin = req.user!.roles.some((role: any) => role.role === Role.ADMIN);

      // Convert the two arrays into the format expected by the service
      const sections = section_ids.map((id: string, index: number) => ({
        id,
        order_index: order_indices[index],
      }));

      await sectionService.reorderSections(course_id, sections, user_id, isAdmin);

      res.status(200).json({
        success: true,
        message: 'Sections reordered successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SectionController();
