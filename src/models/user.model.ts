import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import bcrypt from "bcrypt";
import { generateUniqueId } from "../utils/uuid";

// User attributes interface
interface UserAttributes {
  id: string;
  name: string;
  email: string;
  password: string;
  bio?: string;
  profile_thumbnail?: string;
  is_active: boolean;
  token_version: number;
  created_at?: Date;
  updated_at?: Date;
}

// User creation attributes interface (optional id, timestamps)
interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    'id' | 'created_at' | 'updated_at' | 'is_active' | 'token_version'
  > {}

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public bio!: string | undefined;
  public profile_thumbnail!: string | undefined;
  public is_active!: boolean;
  public token_version!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Method to verify password
  public async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Method to increment token version (invalidates all existing tokens)
  public async incrementTokenVersion(): Promise<void> {
    await this.increment('token_version');
    await this.reload();
  }

  // Define associations
  public static associate(models: any): void {
    // User has many UserRoles
    User.hasMany(models.UserRole, {
      foreignKey: 'user_id',
      as: 'roles',
    });

    // User has many RefreshTokens
    User.hasMany(models.RefreshToken, {
      foreignKey: 'user_id',
      as: 'refreshTokens',
    });

    // User has many Courses (as instructor)
    User.hasMany(models.Course, {
      foreignKey: 'instructor_id',
      as: 'courses',
    });

    // User has many Enrollments (as student)
    User.hasMany(models.Enrollment, {
      foreignKey: 'user_id',
      as: 'enrollments',
      onDelete: 'CASCADE',
    });

    // User has many LessonCompletions
    User.hasMany(models.LessonCompletion, {
      foreignKey: 'user_id',
      as: 'completedLessons',
      onDelete: 'CASCADE',
    });

    // User has many Reviews
    User.hasMany(models.Review, {
      foreignKey: 'user_id',
      as: 'reviews',
      onDelete: 'CASCADE',
    });
  }
}

// Initialize User model
User.init(
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
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile_thumbnail: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    token_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
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
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['is_active'],
        name: 'users_is_active_idx',
      },
      {
        fields: ['created_at'],
        name: 'users_created_at_idx',
      },
      {
        fields: ['name'],
        name: 'users_name_idx',
      },
      {
        fields: ['token_version'],
        name: 'users_token_version_idx',
      },
    ],
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;
