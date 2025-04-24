import Joi from "joi";
import { Role } from "../models/user-role.model";

// Register validation schema
export const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().required().email(),
    password: Joi.string().required().min(8).max(30),
  }).required(),
});

// Login validation schema
export const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
  }).required(),
});

// Update user validation schema
export const updateUserSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    bio: Joi.string().allow("", null),
  }).required(),
  params: Joi.object({
    id: Joi.number().required(),
  }).required(),
});

// Change password validation schema
export const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().required().min(8).max(30),
  }).required(),
  params: Joi.object({
    id: Joi.number().required(),
  }).required(),
});

// Role validation schema
export const roleSchema = Joi.object({
  body: Joi.object({
    role: Joi.string()
      .required()
      .valid(...Object.values(Role)),
  }).required(),
  params: Joi.object({
    id: Joi.number().required(),
  }).required(),
});
