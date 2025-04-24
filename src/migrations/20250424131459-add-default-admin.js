"use strict";

const bcrypt = require("bcrypt");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    try {
      // Check if users table exists
      try {
        // Check if admin user already exists
        const [existingAdmins] = await queryInterface.sequelize.query(
          "SELECT id FROM users WHERE email = 'admin@example.com'"
        );

        if (existingAdmins.length > 0) {
          console.log("Admin user already exists, skipping creation");
          return;
        }
      } catch (error) {
        // If the table doesn't exist, we'll just continue with creating the admin
        if (error.original && error.original.code === "ER_NO_SUCH_TABLE") {
          console.log("Users table doesn't exist yet, will create admin user");
        } else {
          throw error;
        }
      }

      // 1. Hash password
      const hashed = await bcrypt.hash("admin123123@", 10);

      // 2. Generate a unique ID for admin (similar to your TypeScript function)
      const generateUniqueId = () => {
        const timestamp = Date.now().toString();
        const randomPart = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        return `${timestamp}${randomPart}`;
      };

      const adminId = generateUniqueId();

      // 3. Insert user with explicit ID
      await queryInterface.bulkInsert(
        "users",
        [
          {
            id: adminId, // Provide the generated ID explicitly
            name: "Admin",
            email: "admin@example.com",
            password: hashed,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        {}
      );

      // 4. Insert role (note: we don't need to specify the id field as it's auto-incrementing)
      await queryInterface.bulkInsert(
        "user_roles",
        [
          {
            user_id: adminId,
            role: "admin",
          },
        ],
        {}
      );

      console.log("Default admin user created successfully");
    } catch (error) {
      console.error("Error creating default admin:", error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Get admin id
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM `users` WHERE email = 'admin@example.com';"
      );
      const admin = rows[0];
      if (!admin) return;

      // Delete user roles first (foreign key constraint)
      await queryInterface.bulkDelete("user_roles", { user_id: admin.id });

      // Then delete the user
      await queryInterface.bulkDelete("users", { id: admin.id });

      console.log("Default admin user removed successfully");
    } catch (error) {
      console.error("Error removing default admin:", error);
      throw error;
    }
  },
};
