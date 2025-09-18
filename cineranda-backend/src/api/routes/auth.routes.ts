import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// --- PUBLIC ROUTES ---
// Kept your existing public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-phone', authController.verifyPhone);

// Use the new, clean implementation for forgot/reset PIN
router.post('/forgot-pin', authController.forgotPin);
router.post('/reset-pin', authController.resetPin);

// --- PROTECTED ROUTES ---
// This middleware protects all routes defined after it
router.use(authenticate); 

// Kept your existing protected routes
router.get('/profile', authController.getProfile);
router.patch('/profile', authController.updateProfile);
router.post('/change-pin', authController.changePin);

export default router;