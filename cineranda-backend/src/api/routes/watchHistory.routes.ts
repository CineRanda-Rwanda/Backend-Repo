import { Router } from 'express';
import { WatchHistoryController } from '../controllers/watchHistory.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const watchHistoryController = new WatchHistoryController();

// All routes require authentication
router.use(authenticate);
router.get('/', watchHistoryController.getUserWatchHistory);
router.get('/in-progress', watchHistoryController.getInProgressMovies);
router.post('/update', watchHistoryController.updateWatchProgress);

export default router;