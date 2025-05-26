import { Sequelize } from "sequelize";
import { config } from "dotenv";
import User from "./user.model";
import UserRole from "./user-role.model";
import RefreshToken from "./refresh-token.model";
import Category from "./category.model";
import Course from "./course.model";
import CourseCategory from "./course-category.model";
import Section from "./section.model";
import Lesson from "./lesson.model";
import LessonCompletion from "./lesson-completion.model";
import Enrollment from "./enrollment.model";
import Payment from "./payment.model";
import Refund from "./refund.model";
import Review from "./review.model";

// Load environment variables
config();

// Import database configuration
import sequelize from "../config/database";

// Initialize models
const models = {
  User,
  UserRole,
  RefreshToken,
  Category,
  Course,
  CourseCategory,
  Section,
  Lesson,
  LessonCompletion,
  Enrollment,
  Payment,
  Refund,
  Review,
};

// Set up associations
Object.values(models).forEach((model: any) => {
  if (model.associate) {
    model.associate(models);
  }
});

export { sequelize, Sequelize };
export default models;
