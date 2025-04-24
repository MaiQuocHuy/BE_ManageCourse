/**
 * Utility để tạo ID duy nhất dạng chuỗi số
 */

/**
 * Tạo ID duy nhất dựa trên timestamp hiện tại và số ngẫu nhiên
 * Format: [timestamp][random]
 * Ví dụ: 16893254789123456
 * @returns ID duy nhất dạng chuỗi số
 */
export const generateUniqueId = (): string => {
  // Lấy timestamp hiện tại (milliseconds)
  const timestamp = Date.now().toString();

  // Tạo số ngẫu nhiên 4 chữ số
  const randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  // Kết hợp timestamp và số ngẫu nhiên
  return `${timestamp}${randomPart}`;
};

/**
 * Kiểm tra xem một ID đã tồn tại trong danh sách các ID hay chưa
 * @param id ID cần kiểm tra
 * @param existingIds Danh sách ID đã tồn tại
 * @returns true nếu ID đã tồn tại, false nếu chưa
 */
export const isIdExists = (id: string, existingIds: string[]): boolean => {
  return existingIds.includes(id);
};

/**
 * Tạo ID duy nhất đảm bảo không trùng với các ID đã tồn tại
 * @param existingIds Danh sách ID đã tồn tại
 * @returns ID duy nhất dạng chuỗi số
 */
export const createUniqueId = (existingIds: string[]): string => {
  let id = generateUniqueId();

  // Kiểm tra và tạo lại ID nếu trùng lặp (rất hiếm khi xảy ra)
  while (isIdExists(id, existingIds)) {
    id = generateUniqueId();
  }

  return id;
};
