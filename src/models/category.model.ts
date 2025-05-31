import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";

interface CategoryAttributes {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: Date;
  updated_at?: Date;
}

interface CategoryCreationAttributes
  extends Optional<
    CategoryAttributes,
    | "id"
    | "created_at"
    | "updated_at"
    | "slug"
    | "description"
    | "display_order"
  > {}

class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: string;
  public name!: string;
  public slug!: string;
  public description!: string | null;
  public parent_id!: string | null;
  public is_active!: boolean;
  public display_order!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public readonly children?: Category[];
  public readonly parent?: Category;

  public static associate(models: any): void {
    // Self-referential association (parent-child relationships)
    Category.hasMany(models.Category, {
      foreignKey: "parent_id",
      as: "children",
    });

    Category.belongsTo(models.Category, {
      foreignKey: "parent_id",
      as: "parent",
    });

    // Many-to-many relationship with Course
    Category.belongsToMany(models.Course, {
      through: "course_categories",
      foreignKey: "category_id",
      otherKey: "course_id",
      as: "courses",
    });
  }
}

Category.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    display_order: {
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
    tableName: 'categories',
    sequelize,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['parent_id'],
        name: 'categories_parent_id_idx',
      },
      {
        fields: ['parent_id', 'display_order'],
        name: 'categories_parent_order_idx',
      },
      {
        fields: ['is_active'],
        name: 'categories_is_active_idx',
      },
    ],
  }
);

export default Category;
