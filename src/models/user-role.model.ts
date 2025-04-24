import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";
import User from "./user.model";

// Role types
export enum Role {
  STUDENT = "student",
  INSTRUCTOR = "instructor",
  ADMIN = "admin",
}

// UserRole attributes interface
interface UserRoleAttributes {
  id: number;
  user_id: string;
  role: Role;
}

// UserRole creation attributes
// interface UserRoleCreationAttributes extends UserRoleAttributes {}
interface UserRoleCreationAttributes
  extends Partial<Pick<UserRoleAttributes, "id">>,
    Omit<UserRoleAttributes, "id"> {}

// UserRole model class
class UserRole
  extends Model<UserRoleAttributes, UserRoleCreationAttributes>
  implements UserRoleAttributes
{
  public id!: number;
  public user_id!: string;
  public role!: Role;
}

// Initialize UserRole model
UserRole.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    role: {
      type: DataTypes.ENUM(...Object.values(Role)),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "user_roles",
    timestamps: false,
    underscored: true,
  }
);

// Define association
User.hasMany(UserRole, { foreignKey: "user_id", as: "roles" });
UserRole.belongsTo(User, { foreignKey: "user_id" });

export default UserRole;
