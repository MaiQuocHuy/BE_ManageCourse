import Joi from "joi";
import { query } from "winston";

// Create category validation schema
export const createCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().allow("", null),
    parent_id: Joi.string()
      .pattern(/^\d+$/) // toàn số
      .max(20)
      .allow(null, ""), // hoặc vắng
  }).required(),
});

// Update category validation schema
export const updateCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    description: Joi.string().allow("", null),
    parent_id: Joi.string()
      .pattern(/^\d+$/) // toàn số
      .max(20)
      .allow(null, ""),
    is_active: Joi.boolean(),
  }).required(),
  params: Joi.object({
    id: Joi.string()
      .pattern(/^\d+$/) // Chỉ chấp nhận chuỗi số
      .max(20) // Giới hạn độ dài 20 ký tự
      .required(),
  }).required(),
});

export const getHierarchySchema = Joi.object({
  query: Joi.object({
    include_inactive: Joi.boolean().optional().default(true),
  }),
});

// Get category validation schema
export const getCategorySchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .pattern(/^\d+$/) // Chỉ chấp nhận chuỗi số
      .max(20) // Giới hạn độ dài 20 ký tự
      .required(),
  }).required(),
});

// Get category by slug validation schema
export const getCategoryBySlugSchema = Joi.object({
  params: Joi.object({
    slug: Joi.string().required(),
  }).required(),
});

// Associate course with category validation schema
export const courseCategorySchema = Joi.object({
  body: Joi.object({
    category_id: Joi.string().required(),
  }).required(),
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});

// Disassociate course from category validation schema
export const disassociateCourseSchema = Joi.object({
  body: Joi.object({
    category_id: Joi.string().required(),
  }).required(),
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});

// Get courses for category validation schema
export const getCoursesForCategorySchema = Joi.object({
  params: Joi.object({
    categoryId: Joi.string().required(),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    include_subcategories: Joi.boolean(),
  }),
});
