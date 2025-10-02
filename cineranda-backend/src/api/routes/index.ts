import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import contentRoutes from './content.routes';
import adminRoutes from './admin.routes';
import settingsRoutes from './settings.routes';
import verificationRoutes from './verification.routes';
import genreRoutes from './genre.routes';
import categoryRoutes from './category.routes';
import watchHistoryRoutes from './watchHistory.routes';
import ratingRoutes from './rating.routes';
import favoriteRoutes from './favorite.routes';

const router = Router();

// Existing routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/content', contentRoutes);
router.use('/admin', adminRoutes);
router.use('/settings', settingsRoutes);
router.use('/verification', verificationRoutes);

// New routes
router.use('/genres', genreRoutes);
router.use('/categories', categoryRoutes);
router.use('/watch-history', watchHistoryRoutes);
router.use('/ratings', ratingRoutes);
router.use('/favorites', favoriteRoutes);

export default router;