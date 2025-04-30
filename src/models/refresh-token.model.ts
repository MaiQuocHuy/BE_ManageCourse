import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";
import User from "./user.model";

// RefreshToken attributes interface
interface RefreshTokenAttributes {
  id: number;
  user_id: string;
  token: string;
  expires_at: Date;
  is_revoked: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// RefreshToken creation attributes
interface RefreshTokenCreationAttributes
  extends Omit<RefreshTokenAttributes, "id" | "created_at" | "updated_at"> {}

// RefreshToken model class
class RefreshToken
  extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes>
  implements RefreshTokenAttributes
{
  public id!: number;
  public user_id!: string;
  public token!: string;
  public expires_at!: Date;
  public is_revoked!: boolean;
  public created_at!: Date;
  public updated_at!: Date;
}

// Initialize RefreshToken model
RefreshToken.init(
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
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "refresh_tokens",
    timestamps: true,
    underscored: true,
  }
);

// Define association
// Note: The User-RefreshToken association is defined in the User model's associate method
RefreshToken.belongsTo(User, { foreignKey: "user_id" });

export default RefreshToken;
