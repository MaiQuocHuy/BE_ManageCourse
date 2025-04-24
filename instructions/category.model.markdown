# Category Model

## Overview

The Category model represents and manages course categories, supporting a hierarchical structure for organizing courses.

## Schema

```typescript
interface Category {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  parent_id?: number;
  is_active: boolean;
  display_order?: number;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  parent_id INT,
  is_active BOOLEAN DEFAULT true,
  display_order INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

## Additional Table: course_categories

For many-to-many relationship between courses and categories.

```sql
CREATE TABLE IF NOT EXISTS course_categories (
  course_id INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (course_id, category_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

## Methods

- `initCategoryTable`: Creates the categories table if it doesn’t exist.
- `initCategoryCoursesTable`: Creates the course_categories table if it doesn’t exist.
- `createCategory`: Creates a new category.
- `getCategoryById`: Retrieves a category by its ID.
- `getCategoryBySlug`: Retrieves a category by its slug.
- `getAllCategories`: Retrieves all categories, with an option to filter by parent_id.
- `getCategoryHierarchy`: Builds a hierarchical structure of categories.
- `updateCategory`: Updates an existing category.
- `deleteCategory`: Deletes a category and reassigns any child categories.
- `addDefaultCategories`: Adds a set of default categories to the database.
- `associateCourseWithCategory`: Associates a course with a category, with an option to set it as the primary category.
- `disassociateCourseFromCategory`: Removes the association between a course and a category.
- `getCategoriesForCourse`: Retrieves all categories associated with a specific course.
- `getPrimaryCategoryForCourse`: Retrieves the primary category of a course.
- `getCoursesForCategory`: Retrieves all courses in a specific category, with an option to include subcategories.
- `getCategoryCounts`: Retrieves the count of courses for each category.
