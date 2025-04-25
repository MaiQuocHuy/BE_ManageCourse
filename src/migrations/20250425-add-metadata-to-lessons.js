'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('lessons', 'metadata', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'is_free'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lessons', 'metadata');
  }
};
