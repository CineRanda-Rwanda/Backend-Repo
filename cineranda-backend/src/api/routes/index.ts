import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes'; // Add this line to import admin routes

const router = Router();

// Keep your existing auth routes
router.use('/auth', authRoutes);

// Add this line to mount the admin routes under the /admin path
router.use('/admin', adminRoutes);

export default router;