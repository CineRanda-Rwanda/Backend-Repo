import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authenticate, restrictToAdmin } from '../../middleware/auth.middleware';

const router = Router();
const categoryController = new CategoryController();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/featured', categoryController.getFeaturedCategories);

// Admin routes
router.use(authenticate, restrictToAdmin);
router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

export default router;