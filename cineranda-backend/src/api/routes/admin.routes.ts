import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate, restrictToAdmin } from '../../middleware/auth.middleware';

const router = Router();
const adminController = new AdminController();

// Protect all routes in this file with both authentication and admin role checks
router.use(authenticate, restrictToAdmin);

// --- Admin User Management ---
router.post('/users/create-admin', adminController.createAdmin);

// --- Admin Content Management ---
// (You would add routes for movie upload, edit, delete here)
// Example: router.post('/movies', movieController.uploadMovie);

// --- Admin User Access Control ---
router.post('/users/grant-access', adminController.grantFreeAccess);

// --- Admin Analytics ---
router.get('/analytics/dashboard', adminController.getAnalytics);

export default router;