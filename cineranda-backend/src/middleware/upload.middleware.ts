import crypto from 'crypto';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type { Request } from 'express';
import config from '../config';
import AppError from '../utils/AppError';

const { accessKeyId, secretAccessKey, region, s3Bucket } = config.aws;

if (!accessKeyId || !secretAccessKey || !region || !s3Bucket) {
  throw new Error('AWS configuration is incomplete. Cannot initialize upload middleware.');
}

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const folderMap: Record<string, string> = {
  posterImage: 'posters',
  movieFile: 'movies',
  videoFile: 'videos',
  thumbnailImage: 'thumbnails',
  subtitleEn: 'subtitles',
  subtitleFr: 'subtitles',
  subtitleKin: 'subtitles',
};

type MetadataCallback = (error: Error | null, metadata?: Record<string, any>) => void;
type KeyCallback = (error: Error | null, key?: string) => void;

// Configure multer to stream uploads directly to S3
const storage = multerS3({
  s3,
  bucket: s3Bucket,
  acl: 'private',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (_req: Request, file: Express.Multer.File, cb: MetadataCallback) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (_req: Request, file: Express.Multer.File, cb: KeyCallback) => {
    const folder = folderMap[file.fieldname] || 'uploads';
    const sanitizedName = file.originalname.replace(/\s+/g, '-');
    const uniqueName = `${folder}/${crypto.randomBytes(16).toString('hex')}-${sanitizedName}`;
    cb(null, uniqueName);
  },
});

// File filter - allow images, videos, and subtitles
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
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
  storage,
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