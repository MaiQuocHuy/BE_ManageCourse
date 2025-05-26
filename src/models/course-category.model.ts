import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

interface CourseCategoryAttributes {
  course_id: string;
  category_id: string;
}

interface CourseCategoryCreationAttributes extends CourseCategoryAttributes {}

class CourseCategory
  extends Model<CourseCategoryAttributes, CourseCategoryCreationAttributes>
  implements CourseCategoryAttributes
{
  public course_id!: string;
  public category_id!: string;

  // No need for associates method as this is a junction table
}

CourseCategory.init(
  {
    course_id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    category_id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
  {
    tableName: 'course_categories',
    sequelize,
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['course_id'],
        name: 'course_categories_course_id_idx',
      },
      {
        fields: ['category_id'],
        name: 'course_categories_category_id_idx',
      },
    ],
  }
);

export default CourseCategory;
