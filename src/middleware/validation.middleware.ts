import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ApiError } from "../utils/api-error";

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const toValidate = ["body", "params", "query"] as const;

      for (const key of toValidate) {
        if (schema.$_terms.keys?.some((k: any) => k.key === key)) {
          const partSchema = schema.extract(key);
          const { error } = partSchema.validate(req[key], {
            abortEarly: false,
          });
          if (error) {
            const errors = error.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            }));
            return next(new ApiError(400, "Validation error", errors));
          }
        }
      }

      next();
    } catch (error: any) {
      console.error(`Validation error for ${req.method} ${req.path}:`, error);
      next(new ApiError(500, "Validation middleware error", error));
    }
  };
};
