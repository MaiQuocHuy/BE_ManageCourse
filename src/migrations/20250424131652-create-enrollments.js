"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("enrollments", {
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
      course_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "courses",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // Add unique constraint to prevent duplicate enrollments
    await queryInterface.addConstraint("enrollments", {
      fields: ["user_id", "course_id"],
      type: "unique",
      name: "unique_user_course_enrollment",
    });

    // Add indexes for faster queries
    await queryInterface.addIndex("enrollments", ["user_id"]);
    await queryInterface.addIndex("enrollments", ["course_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("enrollments");
  },
};
