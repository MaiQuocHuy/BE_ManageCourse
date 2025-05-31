'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the is_free column from lessons table
    await queryInterface.removeColumn('lessons', 'is_free');
  },

  async down(queryInterface, Sequelize) {
    // Rollback: Add the is_free column back to lessons table
    await queryInterface.addColumn('lessons', 'is_free', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
};
