# Lesson Model

## Overview

The Lesson model represents individual learning units within course sections, supporting various content types such as videos, text lessons, quizzes, and assignments.

## Schema

```typescript
interface Lesson {
  id?: number;
  section_id: number;
  title: string;
  type: "video";
  content: string;
  duration?: number;
  order_index: number;
  is_free: boolean;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('video') NOT NULL,
  content TEXT,
  duration INT,
  order_index INT NOT NULL DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE CASCADE
);
```

## Additional Table: lesson_completions

To track which users have completed which lessons.

```sql
CREATE TABLE IF NOT EXISTS lesson_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE (user_id, lesson_id)
);
```

## Methods

- `createLesson`: Adds a new lesson to a section.
- `getLessonById`: Fetches a specific lesson using its ID.
- `getLessonsBySection`: Retrieves all lessons in a given section, ordered by their display order.
- `updateLesson`: Modifies the attributes of an existing lesson.
- `deleteLesson`: Removes a lesson.
- `reorderLessons`: Adjusts the order of multiple lessons in a single database transaction.
- `markLessonCompleted`: Records that a user has completed a lesson.
- `isLessonCompleted`: Checks if a specific user has completed a particular lesson.
- `getCompletedLessons`: Lists all lessons completed by a user in a specific course.
- `getCourseCompletionPercentage`: Calculates the completion percentage of a course for a user.
- `getNextLesson`: Identifies the next uncompleted lesson for a user within a course.
