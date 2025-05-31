import Course from '../models/course.model';
import Payment from '../models/payment.model';

export const getPaymentCount = async (where: any = {}, instructor_id?: string): Promise<number> => {
  const includeOptions = instructor_id
    ? [
        {
          model: Course,
          as: 'course',
          where: { instructor_id },
          attributes: [],
        },
      ]
    : [];

  return Payment.count({ where, include: includeOptions });
};
