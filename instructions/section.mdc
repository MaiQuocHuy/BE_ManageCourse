# Section Model

## Overview

The Section model represents course sections that help organize lessons within a course, thereby creating a structured learning experience.

## Schema

```typescript
interface Section {
  id?: number;
  course_id: number;
  title: string;
  description?: string;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS course_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
```

## Methods

- `createSection`: Creates a new section within a course.
- `getCourseSections`: Retrieves all sections for a specific course, ordered by their display order.
- `getSectionById`: Fetches a section using its unique ID.
- `updateSection`: Updates the title, description, or order of an existing section.
- `deleteSection`: Removes a section and all its associated lessons.
- `reorderSections`: Adjusts the order of multiple sections in a single database transaction.
