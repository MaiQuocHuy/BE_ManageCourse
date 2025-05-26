"use strict";

const bcrypt = require("bcrypt");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    try {
      // Check if users table exists
      try {
        // Check if student user already exists
        const [existingStudents] = await queryInterface.sequelize.query(
          "SELECT id FROM users WHERE email = 'student@example.com'"
        );

        if (existingStudents.length > 0) {
          console.log("Student user already exists, skipping creation");
          return;
        }
      } catch (error) {
        // If the table doesn't exist, we'll just continue with creating the student
        if (error.original && error.original.code === "ER_NO_SUCH_TABLE") {
          console.log("Users table doesn't exist yet, will create student user");
        } else {
          throw error;
        }
      }

      // 1. Hash password
      const hashed = await bcrypt.hash("student123@", 10);

      // 2. Generate a unique ID for student
      const generateUniqueId = () => {
        const timestamp = Date.now().toString();
        const randomPart = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        return `${timestamp}${randomPart}`;
      };

      const studentId = generateUniqueId();

      // 3. Insert user with explicit ID
      await queryInterface.bulkInsert(
        "users",
        [
          {
            id: studentId,
            name: "Student",
            email: "student@example.com",
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
            user_id: studentId,
            role: "student",
          },
        ],
        {}
      );

      console.log("Default student user created successfully");
    } catch (error) {
      console.error("Error creating default student:", error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    try {
      // Get student id
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM `users` WHERE email = 'student@example.com';"
      );
      const student = rows[0];
      if (!student) return;

      // Delete user roles first (foreign key constraint)
      await queryInterface.bulkDelete("user_roles", { user_id: student.id });

      // Then delete the user
      await queryInterface.bulkDelete("users", { id: student.id });

      console.log("Default student user removed successfully");
    } catch (error) {
      console.error("Error removing default student:", error);
      throw error;
    }
  },
}; 