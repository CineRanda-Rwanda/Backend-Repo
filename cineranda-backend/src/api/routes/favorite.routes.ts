import { Router } from 'express';
import { FavoriteController } from '../controllers/favorite.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const favoriteController = new FavoriteController();

// All routes require authentication
router.use(authenticate);
router.get('/', favoriteController.getUserFavorites);
router.post('/', favoriteController.addToFavorites);
router.delete('/:movieId', favoriteController.removeFromFavorites);
router.get('/check/:movieId', favoriteController.checkFavoriteStatus);

export default router;