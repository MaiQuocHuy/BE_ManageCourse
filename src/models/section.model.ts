import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";
import Course from "./course.model";

// Section attributes interface
interface SectionAttributes {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}

// Section creation attributes interface (optional id, timestamps)
interface SectionCreationAttributes
  extends Optional<
    SectionAttributes,
    "id" | "created_at" | "updated_at" | "description" | "order_index"
  > {}

// Section model class
class Section
  extends Model<SectionAttributes, SectionCreationAttributes>
  implements SectionAttributes
{
  public id!: string;
  public course_id!: string;
  public title!: string;
  public description!: string | null;
  public order_index!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Section belongs to Course
    Section.belongsTo(models.Course, {
      foreignKey: "course_id",
      as: "course",
      onDelete: "CASCADE",
    });

    // Section has many Lessons
    Section.hasMany(models.Lesson, {
      foreignKey: "section_id",
      as: "lessons",
      onDelete: "CASCADE",
    });
  }
}

// Initialize Section model
Section.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    modelName: 'Section',
    tableName: 'course_sections',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['course_id'],
        name: 'sections_course_id_idx',
      },
      {
        fields: ['course_id', 'order_index'],
        name: 'sections_course_order_idx',
      },
    ],
  }
);

export default Section;
