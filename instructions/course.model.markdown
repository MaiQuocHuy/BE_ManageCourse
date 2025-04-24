# Course Model

## Overview

The Course model represents educational courses offered on the platform, including details about the course content, pricing, and metadata.

## Schema

```typescript
interface Course {
  id?: number;
  title: string;
  description?: string;
  instructor_id: number;
  price: number;
  thumbnail?: string;
  thumbnail_public_id?: string;
  is_published: boolean;
  is_approved: boolean;
  created_at?: Date;
  updated_at?: Date;
  categories?: number[];
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  thumbnail VARCHAR(255),
  thumbnail_public_id VARCHAR(255),
  is_published BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Additional Tables

- **course_categories**: For many-to-many relationship between courses and categories.

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

- `initCourseTable`: Creates the courses table if it doesn’t exist.
- `createCourse`: Creates a new course with categories.
- `getCourseById`: Retrieves a course by its ID along with its categories.
- `updateCourse`: Updates an existing course and its categories.
- `deleteCourse`: Removes a course.
- `approveCourse`: Sets the approval status of a course.
- `updateCourseStatus`: Updates course publication
- `getAllCoursesForModeration`: Gets all courses that need moderation/approval.
- `getCourseCategories`: Gets all categories for a course.
- `getCourses`: Gets all courses with filtering and pagination options.
- `getCoursesByInstructorId`: Gets all courses by a specific instructor.
- `searchCourses`: Searches for courses based on keywords.
- `getRecommendedCourses`: Gets course recommendations for a student.
