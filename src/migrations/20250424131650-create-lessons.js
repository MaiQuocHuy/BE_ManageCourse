"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the lessons table with ENUM directly in the column definition
    // MySQL handles ENUMs differently than PostgreSQL
    await queryInterface.createTable("lessons", {
      id: {
        type: Sequelize.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      section_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "course_sections",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("video"),
        allowNull: false,
        defaultValue: "video",
      },

      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Duration in seconds",
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_free: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      metadata: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    // Add index for faster queries
    await queryInterface.addIndex("lessons", ["section_id", "order_index"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("lessons");
    // In MySQL, ENUMs are dropped automatically when the table is dropped
  },
};
