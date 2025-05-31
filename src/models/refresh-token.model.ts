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
  version: number;
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
  last_used_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

// RefreshToken creation attributes
interface RefreshTokenCreationAttributes
  extends Omit<RefreshTokenAttributes, 'id' | 'created_at' | 'updated_at'> {}

// Device information interface for easier typing
export interface DeviceInfo {
  device_name?: string;
  ip_address?: string;
  user_agent?: string;
}

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
  public version!: number;
  public device_name!: string | undefined;
  public ip_address!: string | undefined;
  public user_agent!: string | undefined;
  public last_used_at!: Date | undefined;
  public created_at!: Date;
  public updated_at!: Date;

  // Method to update last used timestamp
  public async updateLastUsed(): Promise<void> {
    await this.update({ last_used_at: new Date() });
  }

  // Method to check if token is valid (not expired and not revoked and correct version)
  public isValid(userTokenVersion: number): boolean {
    return !this.is_revoked && new Date() <= this.expires_at && this.version === userTokenVersion;
  }

  // Method to get device display name
  public getDeviceDisplayName(): string {
    if (this.device_name) {
      return this.device_name;
    }

    // Try to extract device info from user agent
    if (this.user_agent) {
      // Simple device detection logic
      if (this.user_agent.includes('Mobile')) return 'Mobile Device';
      if (this.user_agent.includes('Chrome')) return 'Chrome Browser';
      if (this.user_agent.includes('Firefox')) return 'Firefox Browser';
      if (this.user_agent.includes('Safari')) return 'Safari Browser';
      if (this.user_agent.includes('Edge')) return 'Edge Browser';
    }

    return 'Unknown Device';
  }
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
        key: 'id',
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
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
        name: 'refresh_tokens_user_id_idx',
      },
      {
        fields: ['token'],
        name: 'refresh_tokens_token_idx',
      },
      {
        fields: ['expires_at'],
        name: 'refresh_tokens_expires_at_idx',
      },
      {
        fields: ['is_revoked'],
        name: 'refresh_tokens_is_revoked_idx',
      },
      {
        fields: ['version'],
        name: 'refresh_tokens_version_idx',
      },
      {
        fields: ['user_id', 'version'],
        name: 'refresh_tokens_user_version_idx',
      },
      {
        fields: ['last_used_at'],
        name: 'refresh_tokens_last_used_idx',
      },
    ],
  }
);

// Define association
// Note: The User-RefreshToken association is defined in the User model's associate method
RefreshToken.belongsTo(User, { foreignKey: "user_id" });

export default RefreshToken;
