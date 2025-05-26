import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { generateUniqueId } from '../utils/uuid';
import User from './user.model';
import Course from './course.model';

// Review attributes interface
interface ReviewAttributes {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  review_text: string | null;
  instructor_response: string | null;
  response_date: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

// Review creation attributes interface (optional id, timestamps, and nullable fields)
interface ReviewCreationAttributes
  extends Optional<
    ReviewAttributes,
    'id' | 'review_text' | 'instructor_response' | 'response_date' | 'created_at' | 'updated_at'
  > {}

// Review model class
class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public id!: string;
  public user_id!: string;
  public course_id!: string;
  public rating!: number;
  public review_text!: string | null;
  public instructor_response!: string | null;
  public response_date!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Review belongs to User
    Review.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    // Review belongs to Course
    Review.belongsTo(models.Course, {
      foreignKey: 'course_id',
      as: 'course',
      onDelete: 'CASCADE',
    });
  }
}

// Initialize Review model
Review.init(
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
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    review_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instructor_response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    response_date: {
      type: DataTypes.DATE,
      allowNull: true,
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
    modelName: 'Review',
    tableName: 'reviews',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
        name: 'reviews_user_id_idx',
      },
      {
        fields: ['course_id'],
        name: 'reviews_course_id_idx',
      },
      {
        fields: ['rating'],
        name: 'reviews_rating_idx',
      },
      // Unique composite index to ensure one review per user per course
      {
        unique: true,
        fields: ['user_id', 'course_id'],
        name: 'reviews_user_course_unique',
      },
      {
        fields: ['created_at'],
        name: 'reviews_created_at_idx',
      },
      {
        fields: ['response_date'],
        name: 'reviews_response_date_idx',
      },
    ],
  }
);

export default Review;
