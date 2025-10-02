import { Router } from 'express';
import { RatingController } from '../controllers/rating.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const ratingController = new RatingController();

// Public routes
router.get('/movie/:movieId', ratingController.getMovieRatings);

// Authenticated routes
router.use(authenticate);
router.post('/', ratingController.submitRating);
router.get('/movie/:movieId/user', ratingController.getUserRatingForMovie);
router.delete('/:id', ratingController.deleteRating);

export default router;