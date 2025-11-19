import { Router } from 'express';
import { LibraryController } from '../controllers/library.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const libraryController = new LibraryController();

// Library endpoints
router.post('/', authenticate, libraryController.addToLibrary);
router.get('/', authenticate, libraryController.getLibrary);
router.delete('/:contentId', authenticate, libraryController.removeFromLibrary);

export default router;
