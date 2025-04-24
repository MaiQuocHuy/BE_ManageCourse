"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("user_roles", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
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
      role: {
        type: Sequelize.ENUM("student", "instructor", "admin"),
        allowNull: false,
      },
    });

    // await queryInterface.addIndex("user_roles", ["user_id", "role"], {
    //   unique: true,
    //   name: "user_roles_user_id_role_unique",
    // });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("user_roles");
  },
};
