import Joi from "joi";

// Create section validation schema
export const createSectionSchema = Joi.object({
  body: Joi.object({
    course_id: Joi.string().required(),
    title: Joi.string().required().min(3).max(255),
    description: Joi.string().allow("", null),
  }).required(),
});

// Get section validation schema
export const getSectionSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Get course sections validation schema
export const getCourseSectionsSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});

// Update section validation schema
export const updateSectionSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
  body: Joi.object({
    title: Joi.string().min(3).max(255).allow("", null),
    description: Joi.string().allow("", null),
  })
    .required()
    .min(1), // At least one field must be provided
});

// Delete section validation schema
export const deleteSectionSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Reorder sections validation schema
export const reorderSectionsSchema = Joi.object({
  body: Joi.object().required(),
});
