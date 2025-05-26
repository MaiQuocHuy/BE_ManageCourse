import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";
import User from "./user.model";

// Course attributes interface
interface CourseAttributes {
  id: string;
  title: string;
  description: string | null;
  instructor_id: string;
  price: number;
  thumbnail: string | null;
  thumbnail_public_id: string | null;
  is_published: boolean;
  is_approved: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// Course creation attributes interface (optional id, timestamps)
interface CourseCreationAttributes
  extends Optional<
    CourseAttributes,
    | "id"
    | "created_at"
    | "updated_at"
    | "description"
    | "thumbnail"
    | "thumbnail_public_id"
    | "is_published"
    | "is_approved"
  > {}

// Course model class
class Course
  extends Model<CourseAttributes, CourseCreationAttributes>
  implements CourseAttributes
{
  public id!: string;
  public title!: string;
  public description!: string | null;
  public instructor_id!: string;
  public price!: number;
  public thumbnail!: string | null;
  public thumbnail_public_id!: string | null;
  public is_published!: boolean;
  public is_approved!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Course belongs to User (instructor)
    Course.belongsTo(models.User, {
      foreignKey: 'instructor_id',
      as: 'instructor',
    });

    // Many-to-many relationship with Category
    Course.belongsToMany(models.Category, {
      through: 'course_categories',
      foreignKey: 'course_id',
      otherKey: 'category_id',
      as: 'categories',
    });

    // One-to-many relationship with Section
    Course.hasMany(models.Section, {
      foreignKey: 'course_id',
      as: 'sections',
      onDelete: 'CASCADE',
    });

    // One-to-many relationship with Enrollment
    Course.hasMany(models.Enrollment, {
      foreignKey: 'course_id',
      as: 'enrollments',
      onDelete: 'CASCADE',
    });

    // One-to-many relationship with Review
    Course.hasMany(models.Review, {
      foreignKey: 'course_id',
      as: 'reviews',
      onDelete: 'CASCADE',
    });
  }
}

// Initialize Course model
Course.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instructor_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    thumbnail: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    thumbnail_public_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    modelName: 'Course',
    tableName: 'courses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['instructor_id'],
        name: 'courses_instructor_id_idx',
      },
      {
        fields: ['is_published', 'is_approved'],
        name: 'courses_status_idx',
      },
      {
        fields: ['price'],
        name: 'courses_price_idx',
      },
      {
        fields: ['created_at'],
        name: 'courses_created_at_idx',
      },
      {
        fields: ['title'],
        name: 'courses_title_idx',
      },
    ],
  }
);

export default Course;
