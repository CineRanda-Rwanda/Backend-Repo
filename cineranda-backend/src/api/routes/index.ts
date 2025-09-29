import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import contentRouter from './content.routes';
import userRoutes from './user.routes';
import settingsRoutes from './settings.routes';
import verificationRoutes from './verification.routes';

const router = Router();

// Keep your existing auth routes
router.use('/auth', authRoutes);

// Keep your existing admin routes
router.use('/admin', adminRoutes);

// Add the new content routes
router.use('/content', contentRouter);

// These routes have /api/v1 prefix, which is inconsistent
// Let's fix them to match the pattern above
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);
router.use('/verification', verificationRoutes); // Fixed this path

export default router;