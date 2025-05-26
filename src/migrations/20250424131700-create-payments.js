"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("payments", {
      id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      course_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "courses",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "USD",
      },
      payment_method: {
        type: Sequelize.STRING(20),
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
    await queryInterface.addIndex("payments", ["user_id"], {
      name: "payments_user_id_idx",
    });
    await queryInterface.addIndex("payments", ["course_id"], {
      name: "payments_course_id_idx",
    });
    await queryInterface.addIndex("payments", ["status"], {
      name: "payments_status_idx",
    });
    await queryInterface.addIndex("payments", ["transaction_id"], {
      name: "payments_transaction_id_idx",
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("payments");
  },
}; 