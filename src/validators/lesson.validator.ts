import Joi from "joi";
import { LessonType } from "../models/lesson.model";

// Create lesson validation schema
export const createLessonSchema = Joi.object({
  body: Joi.object({
    section_id: Joi.string().required(),
    title: Joi.string().required().min(3).max(255),
    type: Joi.string()
      .valid(...Object.values(LessonType))
      .default(LessonType.VIDEO),
    is_free: Joi.boolean().default(false),
  }).required(),
});

// Get lesson validation schema
export const getLessonSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Get lessons by section validation schema
export const getLessonsBySectionSchema = Joi.object({
  params: Joi.object({
    sectionId: Joi.string().required(),
  }).required(),
});

// Update lesson validation schema
export const updateLessonSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
  body: Joi.object({
    title: Joi.string().min(3).max(255),
    type: Joi.string().valid(...Object.values(LessonType)),
    is_free: Joi.boolean(),
  })
    .required()
    .min(1), // At least one field must be provided
});

// Delete lesson validation schema
export const deleteLessonSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Reorder lessons validation schema
export const reorderLessonsSchema = Joi.object({
  body: Joi.object({
    section_id: Joi.string().required(),
    lesson_ids: Joi.array().items(Joi.string().required()).min(1).required(),
  }).required(),
});

// Mark lesson completed validation schema
export const markLessonCompletedSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Check if lesson is completed validation schema
export const isLessonCompletedSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }).required(),
});

// Get completed lessons validation schema
export const getCompletedLessonsSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});

// Get course completion percentage validation schema
export const getCourseCompletionPercentageSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});

// Get next lesson validation schema
export const getNextLessonSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required(),
  }).required(),
});
