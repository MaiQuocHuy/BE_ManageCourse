import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { generateUniqueId } from '../utils/uuid';

// Payment status enum
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Payment method enum
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  BANK_TRANSFER = 'bank_transfer',
}

// Payment attributes interface
interface PaymentAttributes {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  transaction_id?: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

// Payment creation attributes interface (optional id, transaction_id, metadata, timestamps)
interface PaymentCreationAttributes
  extends Optional<
    PaymentAttributes,
    'id' | 'transaction_id' | 'metadata' | 'created_at' | 'updated_at'
  > {}

// Payment model class
class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes
{
  public id!: string;
  public user_id!: string;
  public course_id!: string;
  public amount!: number;
  public currency!: string;
  public payment_method!: string;
  public status!: string;
  public transaction_id?: string;
  public metadata?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Payment belongs to User
    Payment.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    // Payment belongs to Course
    Payment.belongsTo(models.Course, {
      foreignKey: 'course_id',
      as: 'course',
      onDelete: 'CASCADE',
    });

    // Payment has many Refunds
    Payment.hasMany(models.Refund, {
      foreignKey: 'payment_id',
      as: 'refunds',
      onDelete: 'CASCADE',
    });
  }
}

// Initialize Payment model
Payment.init(
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
    },
    payment_method: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [Object.values(PaymentMethod)],
          msg: 'Invalid payment method',
        },
      },
    },
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: PaymentStatus.PENDING,
      validate: {
        isIn: {
          args: [Object.values(PaymentStatus)],
          msg: 'Invalid payment status',
        },
      },
    },
    transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
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
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
        name: 'payments_user_id_idx',
      },
      {
        fields: ['course_id'],
        name: 'payments_course_id_idx',
      },
      {
        fields: ['status'],
        name: 'payments_status_idx',
      },
      {
        fields: ['transaction_id'],
        name: 'payments_transaction_id_idx',
      },
      {
        fields: ['created_at'],
        name: 'payments_created_at_idx',
      },
      {
        fields: ['status', 'created_at'],
        name: 'payments_status_date_idx',
      },
      {
        fields: ['user_id', 'status'],
        name: 'payments_user_status_idx',
      },
    ],
  }
);

export default Payment;
