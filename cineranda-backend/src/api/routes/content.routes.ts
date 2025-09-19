import { Router } from 'express';
import { ContentController } from '../controllers/content.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();
const contentController = new ContentController();

// Define the fields for multer to expect. This is crucial.
const contentUpload = upload.fields([
  { name: 'posterImage', maxCount: 1 },
  { name: 'movieFile', maxCount: 1 },
  { name: 'subtitleEn', maxCount: 1 },
  { name: 'subtitleFr', maxCount: 1 },
  { name: 'subtitleKin', maxCount: 1 },
]);

// POST /api/v1/content - Create new content (Admin only)
router.post(
  '/',
  authenticate,
  authorize(['admin']), // Protect this route for admins only
  contentUpload,
  contentController.createContent
);

export default router;