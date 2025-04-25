import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";
import User from "./user.model";
import Lesson from "./lesson.model";

// LessonCompletion attributes interface
interface LessonCompletionAttributes {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: Date;
}

// LessonCompletion creation attributes interface (optional id)
interface LessonCompletionCreationAttributes
  extends Optional<LessonCompletionAttributes, "id" | "completed_at"> {}

// LessonCompletion model class
class LessonCompletion
  extends Model<LessonCompletionAttributes, LessonCompletionCreationAttributes>
  implements LessonCompletionAttributes
{
  public id!: string;
  public user_id!: string;
  public lesson_id!: string;
  public completed_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // LessonCompletion belongs to User
    LessonCompletion.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });

    // LessonCompletion belongs to Lesson
    LessonCompletion.belongsTo(models.Lesson, {
      foreignKey: "lesson_id",
      as: "lesson",
      onDelete: "CASCADE",
    });
  }
}

// Initialize LessonCompletion model
LessonCompletion.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
    },
    user_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    lesson_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: "lessons",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "LessonCompletion",
    tableName: "lesson_completions",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "lesson_id"],
      },
    ],
  }
);

export default LessonCompletion;
