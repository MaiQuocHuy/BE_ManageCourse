import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';

// Base upload path
const baseUploadPath = path.join(__dirname, '..', '..', 'uploads');

// Create the directories if they don't exist
const createUploadDirectories = () => {
  const directories = [
    path.join(baseUploadPath, 'images'),
    path.join(baseUploadPath, 'videos'),
    path.join(baseUploadPath, 'temp'),
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Create upload directories on startup
createUploadDirectories();

// Configure storage for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(baseUploadPath, 'images');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  },
});

// Configure storage for videos (temporary storage before Cloudinary upload)
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(baseUploadPath, 'temp');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${ext}`);
  },
});

// File filter for images
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new ApiError(400, 'Only image files are allowed!'));
  }
  cb(null, true);
};

// File filter for videos
const videoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only video files
  const allowedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-flv',
    'video/x-matroska',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only video files are allowed'));
  }
};

// Create multer upload instance for images
export const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Create multer upload instance for videos
export const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size for videos
  },
});

// For backward compatibility
export const upload = imageUpload;

// Optional file upload - allows requests without a file
export const optionalFileUpload = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Kiểm tra xem request có phải multipart không
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      // Nếu không phải multipart/form-data, bỏ qua
      return next();
    }

    // Sử dụng multer với cấu hình để bảo toàn các trường khác
    const multerSingle = upload.single(fieldName);

    // Xử lý upload và lỗi
    multerSingle(req, res, err => {
      if (err instanceof multer.MulterError) {
        // Nếu lỗi LIMIT_UNEXPECTED_FILE (field không tồn tại), bỏ qua lỗi
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next();
        }
        return next(new ApiError(400, err.message));
      } else if (err) {
        return next(err);
      }

      // Log dữ liệu request sau khi xử lý
      console.log('Request body after multer:', req.body);
      next();
    });
  };
};
