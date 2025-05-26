"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("reviews", {
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
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5,
        },
      },
      review_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      instructor_response: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      response_date: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex("reviews", ["user_id"], {
      name: "reviews_user_id_idx",
    });
    await queryInterface.addIndex("reviews", ["course_id"], {
      name: "reviews_course_id_idx",
    });
    await queryInterface.addIndex("reviews", ["rating"], {
      name: "reviews_rating_idx",
    });
    
    // Add unique composite index to ensure one review per user per course
    await queryInterface.addIndex("reviews", ["user_id", "course_id"], {
      name: "reviews_user_course_unique",
      unique: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("reviews");
  },
}; 