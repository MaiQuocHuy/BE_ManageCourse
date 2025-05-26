'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Users table indexes
    await queryInterface.addIndex('users', ['is_active'], {
      name: 'users_is_active_idx',
    });

    await queryInterface.addIndex('users', ['created_at'], {
      name: 'users_created_at_idx',
    });

    await queryInterface.addIndex('users', ['name'], {
      name: 'users_name_idx',
    });

    // Courses table indexes
    await queryInterface.addIndex('courses', ['instructor_id'], {
      name: 'courses_instructor_id_idx',
    });

    await queryInterface.addIndex('courses', ['is_published', 'is_approved'], {
      name: 'courses_status_idx',
    });

    await queryInterface.addIndex('courses', ['price'], {
      name: 'courses_price_idx',
    });

    await queryInterface.addIndex('courses', ['created_at'], {
      name: 'courses_created_at_idx',
    });

    await queryInterface.addIndex('courses', ['title'], {
      name: 'courses_title_idx',
    });

    // Enrollments table indexes
    await queryInterface.addIndex('enrollments', ['user_id'], {
      name: 'enrollments_user_id_idx',
    });

    await queryInterface.addIndex('enrollments', ['course_id'], {
      name: 'enrollments_course_id_idx',
    });

    await queryInterface.addIndex('enrollments', ['created_at'], {
      name: 'enrollments_created_at_idx',
    });

    // Course sections (sections) table indexes
    await queryInterface.addIndex('course_sections', ['course_id'], {
      name: 'sections_course_id_idx',
    });

    await queryInterface.addIndex('course_sections', ['course_id', 'order_index'], {
      name: 'sections_course_order_idx',
    });

    // Lessons table indexes
    await queryInterface.addIndex('lessons', ['section_id'], {
      name: 'lessons_section_id_idx',
    });

    await queryInterface.addIndex('lessons', ['section_id', 'order_index'], {
      name: 'lessons_section_order_idx',
    });

    await queryInterface.addIndex('lessons', ['is_free'], {
      name: 'lessons_is_free_idx',
    });

    await queryInterface.addIndex('lessons', ['type'], {
      name: 'lessons_type_idx',
    });

    // Lesson completions table indexes
    await queryInterface.addIndex('lesson_completions', ['user_id'], {
      name: 'lesson_completions_user_id_idx',
    });

    await queryInterface.addIndex('lesson_completions', ['lesson_id'], {
      name: 'lesson_completions_lesson_id_idx',
    });

    await queryInterface.addIndex('lesson_completions', ['completed_at'], {
      name: 'lesson_completions_completed_at_idx',
    });

    // Payments table additional indexes
    await queryInterface.addIndex('payments', ['created_at'], {
      name: 'payments_created_at_idx',
    });

    await queryInterface.addIndex('payments', ['status', 'created_at'], {
      name: 'payments_status_date_idx',
    });

    await queryInterface.addIndex('payments', ['user_id', 'status'], {
      name: 'payments_user_status_idx',
    });

    // Categories table indexes
    await queryInterface.addIndex('categories', ['parent_id'], {
      name: 'categories_parent_id_idx',
    });

    await queryInterface.addIndex('categories', ['parent_id', 'display_order'], {
      name: 'categories_parent_order_idx',
    });

    await queryInterface.addIndex('categories', ['is_active'], {
      name: 'categories_is_active_idx',
    });

    // Reviews table additional indexes (response_date for instructor responses)
    await queryInterface.addIndex('reviews', ['created_at'], {
      name: 'reviews_created_at_idx',
    });

    await queryInterface.addIndex('reviews', ['response_date'], {
      name: 'reviews_response_date_idx',
    });

    // User roles table indexes
    await queryInterface.addIndex('user_roles', ['user_id'], {
      name: 'user_roles_user_id_idx',
    });

    await queryInterface.addIndex('user_roles', ['role'], {
      name: 'user_roles_role_idx',
    });

    // Refresh tokens table indexes
    await queryInterface.addIndex('refresh_tokens', ['user_id'], {
      name: 'refresh_tokens_user_id_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['token'], {
      name: 'refresh_tokens_token_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['expires_at'], {
      name: 'refresh_tokens_expires_at_idx',
    });

    await queryInterface.addIndex('refresh_tokens', ['is_revoked'], {
      name: 'refresh_tokens_is_revoked_idx',
    });

    // Course categories junction table indexes
    await queryInterface.addIndex('course_categories', ['course_id'], {
      name: 'course_categories_course_id_idx',
    });

    await queryInterface.addIndex('course_categories', ['category_id'], {
      name: 'course_categories_category_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all indexes in reverse order
    const indexesToRemove = [
      // Course categories
      'course_categories_category_id_idx',
      'course_categories_course_id_idx',

      // Refresh tokens
      'refresh_tokens_is_revoked_idx',
      'refresh_tokens_expires_at_idx',
      'refresh_tokens_token_idx',
      'refresh_tokens_user_id_idx',

      // User roles
      'user_roles_role_idx',
      'user_roles_user_id_idx',

      // Reviews
      'reviews_response_date_idx',
      'reviews_created_at_idx',

      // Categories
      'categories_is_active_idx',
      'categories_parent_order_idx',
      'categories_parent_id_idx',

      // Payments
      'payments_user_status_idx',
      'payments_status_date_idx',
      'payments_created_at_idx',

      // Lesson completions
      'lesson_completions_completed_at_idx',
      'lesson_completions_lesson_id_idx',
      'lesson_completions_user_id_idx',

      // Lessons
      'lessons_type_idx',
      'lessons_is_free_idx',
      'lessons_section_order_idx',
      'lessons_section_id_idx',

      // Sections
      'sections_course_order_idx',
      'sections_course_id_idx',

      // Enrollments
      'enrollments_created_at_idx',
      'enrollments_course_id_idx',
      'enrollments_user_id_idx',

      // Courses
      'courses_title_idx',
      'courses_created_at_idx',
      'courses_price_idx',
      'courses_status_idx',
      'courses_instructor_id_idx',

      // Users
      'users_name_idx',
      'users_created_at_idx',
      'users_is_active_idx',
    ];

    for (const indexName of indexesToRemove) {
      try {
        // Extract table name from index name
        const tableName =
          indexName.split('_')[0] === 'course' && indexName.includes('categories')
            ? 'course_categories'
            : indexName.split('_')[0] === 'lesson' && indexName.includes('completions')
              ? 'lesson_completions'
              : indexName.split('_')[0] === 'user' && indexName.includes('roles')
                ? 'user_roles'
                : indexName.split('_')[0] === 'refresh'
                  ? 'refresh_tokens'
                  : indexName.split('_')[0] === 'sections'
                    ? 'course_sections'
                    : indexName.split('_')[0] + 's';

        await queryInterface.removeIndex(tableName, indexName);
      } catch (error) {
        console.log(`Failed to remove index ${indexName}:`, error.message);
      }
    }
  },
};
