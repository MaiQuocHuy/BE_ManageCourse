import Joi from 'joi';

// Create review validation schema
export const createReviewSchema = Joi.object({
  body: Joi.object({
    course_id: Joi.string().required().messages({
      'string.empty': 'Course ID is required',
      'any.required': 'Course ID is required',
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
      'number.base': 'Rating must be a number',
      'number.integer': 'Rating must be an integer',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating must be at most 5',
      'any.required': 'Rating is required',
    }),
    review_text: Joi.string().allow('', null),
  }).required(),
});

// Update review validation schema
export const updateReviewSchema = Joi.object({
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5).messages({
      'number.base': 'Rating must be a number',
      'number.integer': 'Rating must be an integer',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating must be at most 5',
    }),
    review_text: Joi.string().allow('', null),
  })
    .required()
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided',
    }),
  params: Joi.object({
    id: Joi.string().required().messages({
      'string.empty': 'Review ID is required',
      'any.required': 'Review ID is required',
    }),
  }).required(),
});

// Get review by ID validation schema
export const getReviewByIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      'string.empty': 'Review ID is required',
      'any.required': 'Review ID is required',
    }),
  }).required(),
});

// Get user review for course validation schema
export const getUserReviewForCourseSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      'string.empty': 'Course ID is required',
      'any.required': 'Course ID is required',
    }),
  }).required(),
});

// Delete review validation schema
export const deleteReviewSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      'string.empty': 'Review ID is required',
      'any.required': 'Review ID is required',
    }),
  }).required(),
});

// Add instructor response validation schema
export const addInstructorResponseSchema = Joi.object({
  body: Joi.object({
    instructor_response: Joi.string().required().messages({
      'string.empty': 'Instructor response is required',
      'any.required': 'Instructor response is required',
    }),
  }).required(),
  params: Joi.object({
    id: Joi.string().required().messages({
      'string.empty': 'Review ID is required',
      'any.required': 'Review ID is required',
    }),
  }).required(),
});

// Get course reviews validation schema
export const getCourseReviewsSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      'string.empty': 'Course ID is required',
      'any.required': 'Course ID is required',
    }),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    rating: Joi.number().integer().min(1).max(5),
  }),
});

// Get course rating validation schema
export const getCourseRatingSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      'string.empty': 'Course ID is required',
      'any.required': 'Course ID is required',
    }),
  }).required(),
});

// Get instructor reviews validation schema
export const getInstructorReviewsSchema = Joi.object({
  params: Joi.object({
    instructorId: Joi.string().required().messages({
      'string.empty': 'Instructor ID is required',
      'any.required': 'Instructor ID is required',
    }),
  }).required(),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

// Get highest rated courses validation schema
export const getHighestRatedCoursesSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});
