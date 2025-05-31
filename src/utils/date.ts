export function toVNDateRange(rawDate: string, isEnd = false): Date {
  const date = new Date(rawDate);
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  // Trừ 7 giờ để chuyển về UTC
  date.setHours(date.getHours() - 7);
  return date;
}

export function parsePeriodToDate(period: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    // YYYY-MM-DD
    return new Date(period);
  }

  if (/^\d{4}-\d{2}$/.test(period)) {
    // YYYY-MM
    return new Date(period + '-01');
  }

  if (/^\d{4}$/.test(period)) {
    // YYYY
    return new Date(period + '-01-01');
  }

  if (/^\d{4}-\d{1,2}$/.test(period)) {
    // YYYY-WW (week number)
    const [year, week] = period.split('-').map(Number);
    if (!year || !week) return null;

    // Calculate approximate date for the first day (Monday) of the given ISO week
    const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
    const dayOfWeek = jan4.getDay() || 7; // Sunday = 0 => 7
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

    const targetDate = new Date(mondayOfWeek1);
    targetDate.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

    return targetDate;
  }

  return null;
}
