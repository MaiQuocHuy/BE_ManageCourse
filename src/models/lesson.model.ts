import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";

// Lesson types enum
export enum LessonType {
  VIDEO = "video",
  // Future types can be added here: TEXT, QUIZ, ASSIGNMENT, etc.
}

// Lesson attributes interface
interface LessonAttributes {
  id: string;
  section_id: string;
  title: string;
  type: LessonType;
  content: string | null;
  duration: number | null;
  order_index: number;
  metadata: string | null; // JSON string for storing additional data like Cloudinary public_id
  created_at?: Date;
  updated_at?: Date;
}

// Lesson creation attributes interface (optional id, timestamps)
interface LessonCreationAttributes
  extends Optional<
    LessonAttributes,
    'id' | 'created_at' | 'updated_at' | 'content' | 'duration' | 'order_index' | 'metadata'
  > {}

// Lesson model class
class Lesson extends Model<LessonAttributes, LessonCreationAttributes> implements LessonAttributes {
  public id!: string;
  public section_id!: string;
  public title!: string;
  public type!: LessonType;
  public content!: string | null;
  public duration!: number | null;
  public order_index!: number;
  public metadata!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Lesson belongs to Section
    Lesson.belongsTo(models.Section, {
      foreignKey: 'section_id',
      as: 'section',
      onDelete: 'CASCADE',
    });

    // Lesson has many LessonCompletions
    Lesson.hasMany(models.LessonCompletion, {
      foreignKey: 'lesson_id',
      as: 'completions',
      onDelete: 'CASCADE',
    });
  }
}

// Initialize Lesson model
Lesson.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
    },
    section_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'course_sections',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('video'),
      allowNull: false,
      defaultValue: LessonType.VIDEO,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds',
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.TEXT,
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
    modelName: 'Lesson',
    tableName: 'lessons',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['section_id'],
        name: 'lessons_section_id_idx',
      },
      {
        fields: ['section_id', 'order_index'],
        name: 'lessons_section_order_idx',
      },
      {
        fields: ['type'],
        name: 'lessons_type_idx',
      },
    ],
  }
);

export default Lesson;
