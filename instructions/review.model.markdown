# Review Model

## Overview

The Review model handles user reviews and ratings for courses, enabling potential students to assess course quality and allowing instructors to receive feedback.

## Schema

```typescript
interface Review {
  id?: number;
  user_id: number;
  course_id: number;
  rating: number;
  review_text?: string;
  instructor_response?: string;
  response_date?: Date;
  created_at?: Date;
  updated_at?: Date;
}
```

## Database Table

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  instructor_response TEXT,
  response_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY user_course_unique (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
```

## Methods

- `createReview`: Creates or updates a review for a course by a specific user.
- `getReviewById`: Retrieves a review by its unique ID, including user information.
- `getUserReviewForCourse`: Checks if a user has already reviewed a specific course.
- `updateReview`: Updates the rating or text of an existing review.
- `deleteReview`: Deletes a review, restricted to the original reviewer.
- `addInstructorResponse`: Allows the course instructor to add a response to a review.
- `getCourseReviews`: Retrieves all reviews for a specific course, with options for pagination and filtering.
- `getAverageRating`: Calculates the average rating for a course.
- `getRatingDistribution`: Provides a breakdown of how many reviews each rating (1-5 stars) received for a course.
- `getInstructorReviews`: Fetches all reviews for courses taught by a specific instructor.
- `getHighestRatedCourses`: Identifies courses with the highest average review scores on the platform.
