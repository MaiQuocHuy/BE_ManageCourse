"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("refunds", {
      id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        primaryKey: true,
      },
      payment_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "payments",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "pending",
      },
      transaction_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("refunds", ["payment_id"], {
      name: "refunds_payment_id_idx",
    });
    await queryInterface.addIndex("refunds", ["status"], {
      name: "refunds_status_idx",
    });
    await queryInterface.addIndex("refunds", ["transaction_id"], {
      name: "refunds_transaction_id_idx",
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("refunds");
  },
}; 