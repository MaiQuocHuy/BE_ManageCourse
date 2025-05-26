import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";
import User from "./user.model";
import Course from "./course.model";

// Enrollment attributes interface
interface EnrollmentAttributes {
  id: string;
  user_id: string;
  course_id: string;
  created_at?: Date;
  updated_at?: Date;
}

// Enrollment creation attributes interface (optional id, timestamps)
interface EnrollmentCreationAttributes
  extends Optional<EnrollmentAttributes, "id" | "created_at" | "updated_at"> {}

// Enrollment model class
class Enrollment
  extends Model<EnrollmentAttributes, EnrollmentCreationAttributes>
  implements EnrollmentAttributes
{
  public id!: string;
  public user_id!: string;
  public course_id!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Enrollment belongs to User
    Enrollment.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "student",
      onDelete: "CASCADE",
    });

    // Enrollment belongs to Course
    Enrollment.belongsTo(models.Course, {
      foreignKey: "course_id",
      as: "course",
      onDelete: "CASCADE",
    });
  }
}

// Initialize Enrollment model
Enrollment.init(
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
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    course_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Enrollment',
    tableName: 'enrollments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'course_id'],
        name: 'unique_user_course_enrollment',
      },
      {
        fields: ['user_id'],
        name: 'enrollments_user_id_idx',
      },
      {
        fields: ['course_id'],
        name: 'enrollments_course_id_idx',
      },
      {
        fields: ['created_at'],
        name: 'enrollments_created_at_idx',
      },
    ],
  }
);

export default Enrollment;
