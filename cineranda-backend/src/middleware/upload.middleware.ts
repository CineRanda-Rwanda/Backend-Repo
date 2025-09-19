import multer from 'multer';
import AppError from '../utils/AppError';

// Configure multer to use memory storage, as we are not saving files to the server's disk.
const storage = multer.memoryStorage();

// Optional: Filter files to allow only specific types.
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // For now, we allow common video, image, and subtitle formats.
  // You can make this more restrictive if needed.
  if (
    file.mimetype.startsWith('image') ||
    file.mimetype.startsWith('video') ||
    file.mimetype === 'application/x-subrip' || // .srt
    file.mimetype === 'text/vtt' // .vtt
  ) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Please upload only images, videos, or subtitle files.', 400) as any);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});