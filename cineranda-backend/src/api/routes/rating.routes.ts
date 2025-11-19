import { Router } from 'express';
import { RatingController } from '../controllers/rating.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const ratingController = new RatingController();

// Public routes - anyone can view ratings
router.get('/:contentId', ratingController.getMovieRatings);

// Authenticated routes - require login
router.post('/', authenticate, ratingController.submitRating);
router.delete('/:ratingId', authenticate, ratingController.deleteRating);

export default router;