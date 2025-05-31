import Joi from "joi";
import { PaymentMethod, PaymentStatus } from "../models/payment.model";
import { RefundStatus } from "../models/refund.model";

// Create payment schema
export const createPaymentSchema = Joi.object({
  body: Joi.object({
    course_id: Joi.string().required().messages({
      "string.empty": "Course ID is required",
      "any.required": "Course ID is required",
    }),
    amount: Joi.number().positive().required().messages({
      "number.base": "Amount must be a number",
      "number.positive": "Amount must be positive",
      "any.required": "Amount is required",
    }),
    currency: Joi.string().length(3).default("USD").messages({
      "string.base": "Currency must be a string",
      "string.length": "Currency must be 3 characters long",
    }),
    payment_method: Joi.string()
      .valid(...Object.values(PaymentMethod))
      .required()
      .messages({
        "string.empty": "Payment method is required",
        "any.required": "Payment method is required",
        "any.only": `Payment method must be one of: ${Object.values(PaymentMethod).join(
          ", "
        )}`,
      }),
  }),
});

// Get payment by ID schema
export const getPaymentSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Payment ID is required",
      "any.required": "Payment ID is required",
    }),
  }),
});

// Get user payments schema
export const getUserPaymentsSchema = Joi.object({
  params: Joi.object({
    userId: Joi.string().optional(),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string()
      .valid(...Object.values(PaymentStatus))
      .optional()
      .messages({
        "any.only": `Status must be one of: ${Object.values(PaymentStatus).join(
          ", "
        )}`,
      }),
  }),
});

// Get course payments schema
export const getCoursePaymentsSchema = Joi.object({
  params: Joi.object({
    courseId: Joi.string().required().messages({
      'string.empty': 'Course ID is required',
      'any.required': 'Course ID is required',
    }),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string()
      .valid(...Object.values(PaymentStatus))
      .optional()
      .messages({
        'any.only': `Status must be one of: ${Object.values(PaymentStatus).join(', ')}`,
      }),
    search: Joi.string().optional(),
  }),
});

// Update payment status schema
export const updatePaymentStatusSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Payment ID is required",
      "any.required": "Payment ID is required",
    }),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(...Object.values(PaymentStatus))
      .required()
      .messages({
        "string.empty": "Status is required",
        "any.required": "Status is required",
        "any.only": `Status must be one of: ${Object.values(PaymentStatus).join(
          ", "
        )}`,
      }),
  }),
});

// Process refund schema
export const processRefundSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Payment ID is required",
      "any.required": "Payment ID is required",
    }),
  }),
  body: Joi.object({
    reason: Joi.string().required().messages({
      "string.empty": "Reason is required",
      "any.required": "Reason is required",
    }),
    amount: Joi.number().positive().optional().messages({
      "number.base": "Amount must be a number",
      "number.positive": "Amount must be positive",
    }),
  }),
});

// Get revenue by time schema
export const getRevenueByTimeSchema = Joi.object({
  query: Joi.object({
    start_date: Joi.date().iso().required().messages({
      "date.base": "Start date must be a valid date",
      "date.format": "Start date must be in ISO format",
      "any.required": "Start date is required",
    }),
    end_date: Joi.date().iso().required().messages({
      "date.base": "End date must be a valid date",
      "date.format": "End date must be in ISO format",
      "any.required": "End date is required",
    }),
    period: Joi.string().valid("day", "month", "year").default("day").messages({
      "any.only": "Period must be one of: day, month, year",
    }),
  }),
});

// Get revenue statistics schema
export const getRevenueStatisticsSchema = Joi.object({
  query: Joi.object({
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    instructor_id: Joi.string().optional().messages({
      'string.base': 'Instructor ID must be a string',
    }),
  }),
});

// Get instructor revenue schema
export const getInstructorRevenueSchema = Joi.object({
  params: Joi.object({
    instructorId: Joi.string().required().messages({
      "string.empty": "Instructor ID is required",
      "any.required": "Instructor ID is required",
    }),
  }),
  query: Joi.object({
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
  }),
});

// Get highest revenue courses schema
export const getHighestRevenueCoursesSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
  }),
}); 