import { Router } from 'express';
import authRoutes from './auth.routes';
// Import other routes as they are created

const router = Router();

router.use('/auth', authRoutes);
// Add other routes as they are created

export default router;