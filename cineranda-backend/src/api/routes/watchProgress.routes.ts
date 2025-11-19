import { Router } from 'express';
import { WatchProgressController } from '../controllers/watchProgress.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const watchProgressController = new WatchProgressController();

// Watch progress endpoints
router.post('/', authenticate, watchProgressController.saveProgress);
router.get('/', authenticate, watchProgressController.getContinueWatching);
router.get('/:contentId', authenticate, watchProgressController.getProgress);

export default router;
