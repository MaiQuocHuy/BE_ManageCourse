import { Request, Response, NextFunction } from "express";
import { Role } from "../models/user-role.model";
import { ApiError } from "../utils/api-error";

export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Authentication required");
      }

      const hasRole = req.user.roles.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasRole) {
        throw new ApiError(
          403,
          "You don't have permission to access this resource"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
