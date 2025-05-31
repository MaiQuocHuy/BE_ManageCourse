export { BaseRepository, IBaseRepository } from './base.repository';
export { ReviewRepository } from './review.repository';
export { UserRepository } from './user.repository';
export { EnrollmentRepository } from './enrollment.repository';
export { CourseRepository } from './course.repository';
export { SectionRepository } from './section.repository';
export { LessonRepository } from './lesson.repository';
export { CategoryRepository } from './category.repository';
export { PaymentRepository } from './payment.repository';
export { LessonCompletionRepository } from './lesson-completion.repository';

// Export default instances
import reviewRepository from './review.repository';
import userRepository from './user.repository';
import enrollmentRepository from './enrollment.repository';
import courseRepository from './course.repository';
import sectionRepository from './section.repository';
import lessonRepository from './lesson.repository';
import categoryRepository from './category.repository';
import paymentRepository from './payment.repository';
import lessonCompletionRepository from './lesson-completion.repository';
import courseCategoryRepository from './course-category.repository';

export {
  reviewRepository,
  userRepository,
  enrollmentRepository,
  courseRepository,
  sectionRepository,
  lessonRepository,
  categoryRepository,
  paymentRepository,
  lessonCompletionRepository,
  courseCategoryRepository,
};
