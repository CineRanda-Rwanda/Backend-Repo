import multer from 'multer';
import AppError from '../utils/AppError';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter - allow images, videos, and subtitles
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
  },
});

// ✅ Export the fields middleware
export const uploadContentFiles = upload.fields([
  { name: 'posterImage', maxCount: 1 },
  { name: 'movieFile', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 },        // For episodes
  { name: 'thumbnailImage', maxCount: 1 },   // For episodes
  { name: 'subtitleEn', maxCount: 1 },
  { name: 'subtitleFr', maxCount: 1 },
  { name: 'subtitleKin', maxCount: 1 },
]);