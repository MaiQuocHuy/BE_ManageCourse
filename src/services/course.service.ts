import Course from "../models/course.model";
import CourseCategory from "../models/course-category.model";
import Category from "../models/category.model";
import User from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { Op } from "sequelize";
import sequelize from "../config/database";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

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
  category_id?: string;
  is_published?: boolean;
  is_approved?: boolean;
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
      console.error("Error initializing course tables:", error);
      throw new ApiError(500, "Failed to initialize course tables");
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
        folder: "course_thumbnails",
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
      throw new ApiError(500, "Error uploading thumbnail to cloud storage");
    }
  }

  /**
   * Delete thumbnail from Cloudinary
   */
  private async deleteThumbnail(public_id: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(public_id);
    } catch (error) {
      console.error("Error deleting thumbnail from Cloudinary:", error);
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

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Upload thumbnail if provided
      let thumbnailUrl = null;
      let thumbnailPublicId = null;

      if (thumbnail) {
        const uploadResult = await this.uploadThumbnail(thumbnail);
        thumbnailUrl = uploadResult.url;
        thumbnailPublicId = uploadResult.public_id;
      }

      // Create the course
      const course = await Course.create(
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
        const categoryAssociations = categories.map((category_id) => ({
          course_id: course.id,
          category_id,
        }));

        await CourseCategory.bulkCreate(categoryAssociations, { transaction });
      }

      // Commit the transaction
      await transaction.commit();

      // Return the created course with categories
      return this.getCourseById(course.id);
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a course by ID
   */
  async getCourseById(id: string): Promise<Course> {
    const course = await Course.findByPk(id, {
      include: [
        {
          model: Category,
          as: "categories",
          through: { attributes: [] }, // Exclude junction table attributes
        },
        {
          model: User,
          as: "instructor",
          attributes: ["id", "name", "email", "profile_thumbnail"],
        },
      ],
    });

    if (!course) {
      throw new ApiError(404, "Course not found");
    }

    return course;
  }

  /**
   * Update a course
   */
  async updateCourse(
    id: string,
    data: CourseUpdateData,
    currentUserId: string
  ): Promise<Course> {
    const course = await this.getCourseById(id);

    // Check if the user is the instructor of the course
    if (course.instructor_id !== currentUserId) {
      throw new ApiError(403, "You are not authorized to update this course");
    }

    const { title, description, price, thumbnail, is_published, categories } =
      data;

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
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

      // Update the course
      await course.update(
        {
          title: title !== undefined ? title : course.title,
          description:
            description !== undefined ? description : course.description,
          price: price !== undefined ? price : course.price,
          thumbnail: thumbnailUrl,
          thumbnail_public_id: thumbnailPublicId,
          is_published:
            is_published !== undefined ? is_published : course.is_published,
        },
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
          const categoryAssociations = categories.map((category_id) => ({
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

      // Return the updated course with categories
      return this.getCourseById(id);
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
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
      throw new ApiError(403, "You are not authorized to delete this course");
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Delete thumbnail from Cloudinary if exists
      if (course.thumbnail_public_id) {
        await this.deleteThumbnail(course.thumbnail_public_id);
      }

      // Delete the course (cascade will delete course_categories)
      await course.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();
    } catch (error) {
      // Rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Approve a course (admin only)
   */
  async approveCourse(id: string, is_approved: boolean): Promise<Course> {
    const course = await this.getCourseById(id);

    // Update the course approval status
    await course.update({ is_approved });

    // TODO: Send notification to instructor (could be implemented later)

    return this.getCourseById(id);
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
      throw new ApiError(
        403,
        "You are not authorized to update this course's status"
      );
    }

    // Update the course publication status
    await course.update({ is_published });

    return this.getCourseById(id);
  }

  /**
   * Get all courses for moderation (admin only)
   */
  async getAllCoursesForModeration(
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await Course.findAndCountAll({
      where: { is_approved: false },
      include: [
        {
          model: User,
          as: "instructor",
          attributes: ["id", "name", "email"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      courses: rows,
      total: count,
    };
  }

  /**
   * Get categories for a course
   */
  async getCourseCategories(course_id: string): Promise<Category[]> {
    const course = await Course.findByPk(course_id, {
      include: [
        {
          model: Category,
          as: "categories",
          through: { attributes: [] }, // Exclude junction table attributes
        },
      ],
    });

    if (!course) {
      throw new ApiError(404, "Course not found");
    }

    // Use type assertion to handle the categories association
    const categories = course.get("categories") as Category[];
    return categories || [];
  }

  /**
   * Get all courses with pagination and filtering
   */
  async getCourses(
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      category_id,
      is_published = true,
      is_approved = false,
    } = options;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    whereClause.is_published = is_published;

    whereClause.is_approved = is_approved;

    // If category_id is provided, we need to filter by category
    if (category_id) {
      const { count, rows } = await Course.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: "categories",
            through: { attributes: [] },
            where: { id: category_id },
          },
          {
            model: User,
            as: "instructor",
            attributes: ["id", "name", "email", "profile_thumbnail"],
          },
        ],
        limit,
        offset,
        order: [["created_at", "DESC"]],
        distinct: true, // Important for correct count with associations
      });

      return {
        courses: rows,
        total: count,
      };
    } else {
      // If no category_id, just get all courses
      const { count, rows } = await Course.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: "categories",
            through: { attributes: [] },
          },
          {
            model: User,
            as: "instructor",
            attributes: ["id", "name", "email", "profile_thumbnail"],
          },
        ],
        limit,
        offset,
        order: [["created_at", "DESC"]],
        distinct: true, // Important for correct count with associations
      });

      return {
        courses: rows,
        total: count,
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
    const {
      page = 1,
      limit = 10,
      is_published = true,
      is_approved = true,
    } = options;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = { instructor_id };

    // Filter by publication status if needed
    whereClause.is_published = is_published;

    // Filter by approval status if needed
    whereClause.is_approved = is_approved;

    const { count, rows } = await Course.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: "categories",
          through: { attributes: [] },
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    return {
      courses: rows,
      total: count,
    };
  }

  /**
   * Search courses by keyword
   */
  async searchCourses(
    options: SearchOptions
  ): Promise<{ courses: Course[]; total: number }> {
    const {
      keyword,
      page = 1,
      limit = 10,
      category_id,
      is_published = true,
    } = options;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      is_published,
      is_approved: true,
      [Op.or]: [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ],
    };

    // If category_id is provided, we need to filter by category
    if (category_id) {
      const { count, rows } = await Course.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: "categories",
            through: { attributes: [] },
            where: { id: category_id },
          },
          {
            model: User,
            as: "instructor",
            attributes: ["id", "name", "email", "profile_thumbnail"],
          },
        ],
        limit,
        offset,
        order: [["created_at", "DESC"]],
        distinct: true,
      });

      return {
        courses: rows,
        total: count,
      };
    } else {
      // If no category_id, just search all courses
      const { count, rows } = await Course.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Category,
            as: "categories",
            through: { attributes: [] },
          },
          {
            model: User,
            as: "instructor",
            attributes: ["id", "name", "email", "profile_thumbnail"],
          },
        ],
        limit,
        offset,
        order: [["created_at", "DESC"]],
        distinct: true,
      });

      return {
        courses: rows,
        total: count,
      };
    }
  }

  /**
   * Get recommended courses for a user
   * This is a simple implementation that could be enhanced with more sophisticated recommendation algorithms
   */
  async getRecommendedCourses(
    _user_id: string,
    options: PaginationOptions = {}
  ): Promise<{ courses: Course[]; total: number }> {
    const { page = 1, limit = 10 } = options;

    // For now, just return popular courses (could be enhanced later)
    // In a real implementation, this would use user's history, preferences, etc.
    return this.getCourses({
      page,
      limit,
      is_published: true,
      is_approved: false,
    });
  }
}

export default new CourseService();
