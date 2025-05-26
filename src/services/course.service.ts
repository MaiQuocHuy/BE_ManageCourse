import { Transaction } from 'sequelize';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import {
  courseRepository,
  categoryRepository,
  userRepository,
  enrollmentRepository,
} from '../repositories';
import Course from '../models/course.model';
import CourseCategory from '../models/course-category.model';
import Category from '../models/category.model';
import { ApiError } from '../utils/api-error';
import sequelize from '../config/database';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CourseCreateData {
  title: string;
  description?: string;
  instructor_id: string;
  price: number;
  thumbnail?: Express.Multer.File;
  is_published?: boolean;
  is_approved?: boolean;
  categories?: string[];
}

interface CourseUpdateData {
  title?: string;
  description?: string;
  price?: number;
  thumbnail?: Express.Multer.File;
  is_published?: boolean;
  is_approved?: boolean;
  categories?: string[];
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  category?: string;
  is_published?: boolean;
  is_approved?: boolean;
  instructor_id?: string;
  price_min?: number;
  price_max?: number;
  level?: string;
}

interface SearchOptions extends PaginationOptions {
  keyword: string;
}

class CourseService {
  /**
   * Initialize course tables
   */
  async initCourseTable(): Promise<void> {
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id VARCHAR(20) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          instructor_id VARCHAR(20) NOT NULL,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          thumbnail VARCHAR(255),
          thumbnail_public_id VARCHAR(255),
          is_published BOOLEAN DEFAULT false,
          is_approved BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS course_categories (
          course_id VARCHAR(20) NOT NULL,
          category_id VARCHAR(20) NOT NULL,
          PRIMARY KEY (course_id, category_id),
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
      `);

      return;
    } catch (error) {
      console.error('Error initializing course tables:', error);
      throw new ApiError(500, 'Failed to initialize course tables');
    }
  }

  /**
   * Upload thumbnail to Cloudinary
   */
  private async uploadThumbnail(
    file: Express.Multer.File
  ): Promise<{ url: string; public_id: string }> {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'course_thumbnails',
        use_filename: true,
        unique_filename: true,
      });

      // Delete the local file after upload
      fs.unlinkSync(file.path);

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error) {
      // Delete the local file if upload fails
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new ApiError(500, 'Error uploading thumbnail to cloud storage');
    }
  }

  /**
   * Delete thumbnail from Cloudinary
   */
  private async deleteThumbnail(public_id: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(public_id);
    } catch (error) {
      console.error('Error deleting thumbnail from Cloudinary:', error);
      // We don't throw here to avoid blocking the main operation
    }
  }

  /**
   * Create a new course
   */
  async createCourse(data: CourseCreateData): Promise<Course> {
    const {
      title,
      description,
      instructor_id,
      price,
      thumbnail,
      is_published = false,
      is_approved = false,
      categories = [],
    } = data;

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      let thumbnailPublicId = null;

      if (thumbnail) {
        const uploadResult = await this.uploadThumbnail(thumbnail);
        thumbnailUrl = uploadResult.url;
        thumbnailPublicId = uploadResult.public_id;
      }

      // Create the course using repository
      const course = await courseRepository.create(
        {
          title,
          description: description || null,
          instructor_id,
          price,
          thumbnail: thumbnailUrl,
          thumbnail_public_id: thumbnailPublicId,
          is_published,
          is_approved,
        },
        { transaction }
      );

      // Associate categories if provided
      if (categories && categories.length > 0) {
        const categoryAssociations = categories.map(category_id => ({
          course_id: course.id,
          category_id,
        }));

        await CourseCategory.bulkCreate(categoryAssociations, { transaction });
      }

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      // Return the created course with categories using repository
      return await this.getCourseById(course.id);
    } catch (error) {
      // Rollback the transaction
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
   * Get a course by ID
   */
  async getCourseById(id: string): Promise<Course> {
    const course = await courseRepository.findByIdWithDetails(id);

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    return course;
  }

  /**
   * Update a course
   */
  async updateCourse(id: string, data: CourseUpdateData, currentUserId: string): Promise<Course> {
    const course = await this.getCourseById(id);

    // Check if the user is the instructor of the course
    if (course.instructor_id !== currentUserId) {
      throw new ApiError(403, 'You are not authorized to update this course');
    }

    const { title, description, price, thumbnail, is_published, categories } = data;

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Upload new thumbnail if provided
      let thumbnailUrl = course.thumbnail;
      let thumbnailPublicId = course.thumbnail_public_id;

      if (thumbnail) {
        // Delete old thumbnail if exists
        if (course.thumbnail_public_id) {
          await this.deleteThumbnail(course.thumbnail_public_id);
        }

        // Upload new thumbnail
        const uploadResult = await this.uploadThumbnail(thumbnail);
        thumbnailUrl = uploadResult.url;
        thumbnailPublicId = uploadResult.public_id;
      }

      // Update the course using repository
      await courseRepository.update(
        {
          title: title !== undefined ? title : course.title,
          description: description !== undefined ? description : course.description,
          price: price !== undefined ? price : course.price,
          thumbnail: thumbnailUrl,
          thumbnail_public_id: thumbnailPublicId,
          is_published: is_published !== undefined ? is_published : course.is_published,
        },
        { id },
        { transaction }
      );

      // Update categories if provided
      if (categories) {
        // Remove existing associations
        await CourseCategory.destroy({
          where: { course_id: id },
          transaction,
        });

        // Create new associations
        if (categories.length > 0) {
          const categoryAssociations = categories.map(category_id => ({
            course_id: id,
            category_id,
          }));

          await CourseCategory.bulkCreate(categoryAssociations, {
            transaction,
          });
        }
      }

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      // Return the updated course with categories
      return await this.getCourseById(id);
    } catch (error) {
      // Rollback the transaction
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
   * Delete a course
   */
  async deleteCourse(id: string, currentUserId: string): Promise<void> {
    const course = await this.getCourseById(id);

    // Check if the user is the instructor of the course
    if (course.instructor_id !== currentUserId) {
      throw new ApiError(403, 'You are not authorized to delete this course');
    }

    let transaction: Transaction | null = null;

    try {
      // Start a transaction
      transaction = await sequelize.transaction();

      // Delete thumbnail from Cloudinary if exists
      if (course.thumbnail_public_id) {
        await this.deleteThumbnail(course.thumbnail_public_id);
      }

      // Delete the course using repository (cascade will delete course_categories)
      await courseRepository.deleteById(id, { transaction });

      // Commit the transaction
      await transaction.commit();
      transaction = null;
    } catch (error) {
      // Rollback the transaction
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
   * Approve a course (admin only)
   */
  async approveCourse(id: string, is_approved: boolean): Promise<Course> {
    const course = await courseRepository.updateApprovalStatus(id, is_approved);

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    // TODO: Send notification to instructor (could be implemented later)

    return await this.getCourseById(id);
  }

  /**
   * Update course publication status
   */
  async updateCourseStatus(
    id: string,
    is_published: boolean,
    currentUserId: string
  ): Promise<Course> {
    const course = await this.getCourseById(id);

    // Check if the user is the instructor of the course
    if (course.instructor_id !== currentUserId) {
      throw new ApiError(403, "You are not authorized to update this course's status");
    }

    // Update the course publication status using repository
    const updatedCourse = await courseRepository.updateStatus(id, is_published);

    if (!updatedCourse) {
      throw new ApiError(404, 'Course not found');
    }

    return await this.getCourseById(id);
  }

  /**
   * Get all courses for moderation (admin only)
   */
  async getAllCoursesForModeration(
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    const { page = 1, limit = 10 } = options;

    return await courseRepository.findByInstructorId('', {
      page,
      limit,
      status: 'pending', // This maps to is_approved = false
    });
  }

  /**
   * Get categories for a course
   */
  async getCourseCategories(course_id: string): Promise<Category[]> {
    const course = await courseRepository.findByIdWithDetails(course_id);

    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    // Use type assertion to handle the categories association
    const categories = course.get('categories') as Category[];
    return categories || [];
  }

  /**
   * Get all courses with pagination and filtering
   */
  async getCourses(options: PaginationOptions = {}): Promise<{ courses: Course[]; total: number }> {
    const { page = 1, limit = 10, category, is_published = true, is_approved = true } = options;

    if (is_published && is_approved) {
      // Get published and approved courses using repository
      return await courseRepository.findPublishedCourses({
        page,
        limit,
        category,
        price_min: options.price_min,
        price_max: options.price_max,
        level: options.level,
        instructor_id: options.instructor_id,
      });
    } else {
      // Use basic find for other cases
      const result = await courseRepository.findAndCountAll({
        where: {
          is_published,
          is_approved,
        },
        limit,
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']],
      });

      return {
        courses: result.rows,
        total: result.count,
      };
    }
  }

  /**
   * Get courses by instructor ID
   */
  async getCoursesByInstructorId(
    instructor_id: string,
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    return await courseRepository.findByInstructorId(instructor_id, options);
  }

  /**
   * Search courses
   */
  async searchCourses(options: SearchOptions): Promise<{ courses: Course[]; total: number }> {
    const {
      keyword,
      page = 1,
      limit = 10,
      category,
      price_min,
      price_max,
      level,
      instructor_id,
    } = options;

    return await courseRepository.searchCourses(
      keyword,
      {
        categories: category ? [category] : undefined,
        price_range: {
          min: price_min,
          max: price_max,
        },
        level,
        instructor_id,
      },
      { page, limit }
    );
  }

  /**
   * Get recommended courses (simplified for now)
   */
  async getRecommendedCourses(
    user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    // For now, return popular courses (featured courses)
    const featuredCourses = await courseRepository.getFeaturedCourses(options.limit || 10);

    return {
      courses: featuredCourses,
      total: featuredCourses.length,
    };
  }

  /**
   * Get course statistics
   */
  async getCourseStats(): Promise<{
    totalCourses: number;
    publishedCourses: number;
    approvedCourses: number;
    recentCourses: number;
  }> {
    return await courseRepository.getCourseStats();
  }

  /**
   * Get courses with statistics (enrollment count, ratings)
   */
  async getCoursesWithStats(
    options: PaginationOptions = {}
  ): Promise<{ courses: any[]; total: number; page: number; limit: number }> {
    return await courseRepository.findWithStats(options);
  }

  /**
   * Check if user can access course
   */
  async canUserAccessCourse(course_id: string, user_id: string): Promise<boolean> {
    return await courseRepository.canUserAccessCourse(course_id, user_id);
  }

  /**
   * Get course progress for a user (if enrolled)
   */
  async getCourseProgress(course_id: string, user_id: string): Promise<any> {
    // Check if user is enrolled
    const isEnrolled = await enrollmentRepository.isUserEnrolled(user_id, course_id);

    if (!isEnrolled) {
      throw new ApiError(403, 'You must be enrolled in this course to view progress');
    }

    // Get enrollment details
    const enrollment = await enrollmentRepository.findByUserAndCourse(user_id, course_id);

    if (!enrollment) {
      throw new ApiError(404, 'Enrollment not found');
    }

    return {
      progress: 0, // Default progress since field doesn't exist in model
      completion_date: null, // Default completion date
      enrolled_at: enrollment.created_at || new Date(), // Use created_at instead
    };
  }
}

export default new CourseService();
