import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { generateUniqueId } from "../utils/uuid";
import Payment from "./payment.model";

// Refund status enum
export enum RefundStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Refund attributes interface
interface RefundAttributes {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  transaction_id?: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

// Refund creation attributes interface (optional id, transaction_id, metadata, timestamps)
interface RefundCreationAttributes
  extends Optional<
    RefundAttributes,
    "id" | "transaction_id" | "metadata" | "created_at" | "updated_at"
  > {}

// Refund model class
class Refund
  extends Model<RefundAttributes, RefundCreationAttributes>
  implements RefundAttributes
{
  public id!: string;
  public payment_id!: string;
  public amount!: number;
  public reason!: string;
  public status!: string;
  public transaction_id?: string;
  public metadata?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Define associations
  public static associate(models: any): void {
    // Refund belongs to Payment
    Refund.belongsTo(models.Payment, {
      foreignKey: "payment_id",
      as: "payment",
      onDelete: "CASCADE",
    });
  }
}

// Initialize Refund model
Refund.init(
  {
    id: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => generateUniqueId(),
    },
    payment_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: "payments",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: RefundStatus.PENDING,
      validate: {
        isIn: {
          args: [Object.values(RefundStatus)],
          msg: "Invalid refund status",
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
    modelName: "Refund",
    tableName: "refunds",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["payment_id"],
        name: "refunds_payment_id_idx",
      },
      {
        fields: ["status"],
        name: "refunds_status_idx",
      },
      {
        fields: ["transaction_id"],
        name: "refunds_transaction_id_idx",
      },
    ],
  }
);

export default Refund; 