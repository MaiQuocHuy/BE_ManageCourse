import Joi from "joi";

// Create course validation schema
export const createCourseSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().required().min(5).max(255),
    description: Joi.string().allow("", null),
    price: Joi.number().required().min(0),
    is_published: Joi.boolean().default(false),
    categories: Joi.string().allow("", null),
  }).required(),
});

// Update course validation schema
export const updateCourseSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().min(5).max(255),
    description: Joi.string().allow("", null),
    price: Joi.number().min(0),
    is_published: Joi.boolean(),
    categories: Joi.string().allow("", null),
  }).required(),
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Get course validation schema
export const getCourseSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Approve course validation schema
export const approveCourseSchema = Joi.object({
  body: Joi.object({
    is_approved: Joi.boolean().required(),
  }).required(),
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Update course status validation schema
export const updateCourseStatusSchema = Joi.object({
  body: Joi.object({
    is_published: Joi.boolean().required(),
  }).required(),
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Get courses by instructor validation schema
export const getCoursesByInstructorSchema = Joi.object({
  params: Joi.object({
    instructorId: Joi.string().required(),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    is_published: Joi.boolean(),
    is_approved: Joi.boolean(),
  }),
});

// Search courses validation schema
export const searchCoursesSchema = Joi.object({
  query: Joi.object({
    keyword: Joi.string().required().min(2),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    category_id: Joi.string(),
    is_published: Joi.boolean(),
  }).required(),
});

// Get courses validation schema
export const getCoursesSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    category_id: Joi.string(),
    is_published: Joi.boolean(),
    is_approved: Joi.boolean(),
  }),
});

// Get recommended courses validation schema
export const getRecommendedCoursesSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});
