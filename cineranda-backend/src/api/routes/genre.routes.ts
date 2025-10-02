import { Router } from 'express';
import { GenreController } from '../controllers/genre.controller';
import { authenticate, restrictToAdmin } from '../../middleware/auth.middleware';

const router = Router();
const genreController = new GenreController();

// Public routes
router.get('/', genreController.getAllGenres);

// Admin routes
router.use(authenticate, restrictToAdmin);
router.post('/', genreController.createGenre);
router.patch('/:id', genreController.updateGenre);
router.delete('/:id', genreController.deleteGenre);

export default router;