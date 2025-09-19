import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import contentRouter from './content.routes'; // 1. Import the new content router

const router = Router();

// Keep your existing auth routes
router.use('/auth', authRoutes);

// Keep your existing admin routes
router.use('/admin', adminRoutes);

// 2. Add the new content routes
router.use('/content', contentRouter);

export default router;