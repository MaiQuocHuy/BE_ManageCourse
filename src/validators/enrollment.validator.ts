import Joi from "joi";

// Create enrollment schema
export const createEnrollmentSchema = Joi.object({
  body: Joi.object({
    course_id: Joi.string().required().messages({
      "string.empty": "Course ID is required",
      "any.required": "Course ID is required",
    }),
  }),
});

// Get enrollment by ID schema
export const getEnrollmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Enrollment ID is required",
      "any.required": "Enrollment ID is required",
    }),
  }),
});

// Check enrollment schema
export const checkEnrollmentSchema = Joi.object({
  query: Joi.object({
    course_id: Joi.string().required().messages({
      "string.empty": "Course ID is required",
      "any.required": "Course ID is required",
    }),
  }),
});

// Get user enrollments schema
export const getUserEnrollmentsSchema = Joi.object({
  params: Joi.object({
    userId: Joi.string().optional(),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional(),
  }),
});

// Get course enrollments schema
export const getCourseEnrollmentsSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      "string.empty": "Course ID is required",
      "any.required": "Course ID is required",
    }),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional(),
  }),
});

// Get course revenue schema
export const getCourseRevenueSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      "string.empty": "Course ID is required",
      "any.required": "Course ID is required",
    }),
  }),
});

// Get student count by instructor schema
export const getStudentCountByInstructorSchema = Joi.object({
  params: Joi.object({
    instructorId: Joi.string().required().messages({
      "string.empty": "Instructor ID is required",
      "any.required": "Instructor ID is required",
    }),
  }),
});

// Get most popular courses schema
export const getMostPopularCoursesSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
});
