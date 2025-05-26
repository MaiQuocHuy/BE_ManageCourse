"use strict";

const bcrypt = require("bcrypt");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    try {
      // Check if users table exists
      try {
        // Check if instructor user already exists
        const [existingInstructors] = await queryInterface.sequelize.query(
          "SELECT id FROM users WHERE email = 'instructor@example.com'"
        );

        if (existingInstructors.length > 0) {
          console.log("Instructor user already exists, skipping creation");
          return;
        }
      } catch (error) {
        // If the table doesn't exist, we'll just continue with creating the instructor
        if (error.original && error.original.code === "ER_NO_SUCH_TABLE") {
          console.log("Users table doesn't exist yet, will create instructor user");
        } else {
          throw error;
        }
      }

      // 1. Hash password
      const hashed = await bcrypt.hash("instructor123@", 10);

      // 2. Generate a unique ID for instructor
      const generateUniqueId = () => {
        const timestamp = Date.now().toString();
        const randomPart = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        return `${timestamp}${randomPart}`;
      };

      const instructorId = generateUniqueId();

      // 3. Insert user with explicit ID
      await queryInterface.bulkInsert(
        "users",
        [
          {
            id: instructorId,
            name: "Instructor",
            email: "instructor@example.com",
            password: hashed,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        {}
      );

      // 4. Insert role
      await queryInterface.bulkInsert(
        "user_roles",
        [
          {
            user_id: instructorId,
            role: "instructor",
          },
        ],
        {}
      );

      console.log("Default instructor user created successfully");
    } catch (error) {
      console.error("Error creating default instructor:", error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Get instructor id
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM `users` WHERE email = 'instructor@example.com';"
      );
      const instructor = rows[0];
      if (!instructor) return;

      // Delete user roles first (foreign key constraint)
      await queryInterface.bulkDelete("user_roles", { user_id: instructor.id });

      // Then delete the user
      await queryInterface.bulkDelete("users", { id: instructor.id });

      console.log("Default instructor user removed successfully");
    } catch (error) {
      console.error("Error removing default instructor:", error);
      throw error;
    }
  },
}; 