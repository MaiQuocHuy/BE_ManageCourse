"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("lesson_completions", {
      id: {
        type: Sequelize.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      lesson_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "lessons",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // Add unique constraint to prevent duplicate completions
    await queryInterface.addConstraint("lesson_completions", {
      fields: ["user_id", "lesson_id"],
      type: "unique",
      name: "unique_user_lesson_completion",
    });

    // Add index for faster queries
    await queryInterface.addIndex("lesson_completions", ["user_id"]);
    await queryInterface.addIndex("lesson_completions", ["lesson_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("lesson_completions");
  },
};
