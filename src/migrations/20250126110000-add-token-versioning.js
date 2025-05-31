'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add token_version to users table for global token invalidation
    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Version number for token invalidation - increment to revoke all user tokens',
    });

    // Add version to refresh_tokens table to match user's token version
    await queryInterface.addColumn('refresh_tokens', 'version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Token version matching user's token_version at creation time",
    });

    // Add device tracking fields to refresh_tokens table
    await queryInterface.addColumn('refresh_tokens', 'device_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: "User-friendly device name (e.g., 'iPhone 13', 'Chrome on MacBook')",
    });

    await queryInterface.addColumn('refresh_tokens', 'ip_address', {
      type: Sequelize.STRING(45),
      allowNull: true,
      comment: 'IP address when token was created (supports IPv6)',
    });

    await queryInterface.addColumn('refresh_tokens', 'user_agent', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Browser/app user agent string',
    });

    await queryInterface.addColumn('refresh_tokens', 'last_used_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when this refresh token was last used',
    });

    // Add indexes for better performance
    await queryInterface.addIndex('users', ['token_version'], {
      name: 'users_token_version_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['version'], {
      name: 'refresh_tokens_version_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['user_id', 'version'], {
      name: 'refresh_tokens_user_version_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['last_used_at'], {
      name: 'refresh_tokens_last_used_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('users', 'users_token_version_idx');
    await queryInterface.removeIndex('refresh_tokens', 'refresh_tokens_version_idx');
    await queryInterface.removeIndex('refresh_tokens', 'refresh_tokens_user_version_idx');
    await queryInterface.removeIndex('refresh_tokens', 'refresh_tokens_last_used_idx');

    // Remove columns from refresh_tokens table
    await queryInterface.removeColumn('refresh_tokens', 'last_used_at');
    await queryInterface.removeColumn('refresh_tokens', 'user_agent');
    await queryInterface.removeColumn('refresh_tokens', 'ip_address');
    await queryInterface.removeColumn('refresh_tokens', 'device_name');
    await queryInterface.removeColumn('refresh_tokens', 'version');

    // Remove column from users table
    await queryInterface.removeColumn('users', 'token_version');
  },
};
