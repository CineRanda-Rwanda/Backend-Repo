import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// --- PUBLIC ROUTES ---
// Kept your existing public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-phone', authController.verifyPhone);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/2fa/authenticate', authController.authenticate2FA);
router.post('/forgot-pin', authController.forgotPin);
router.post('/reset-pin', authController.resetPin);

// --- PROTECTED ROUTES ---
// Any route below this line will require a valid token
router.use(authenticate);

router.get('/profile', authController.getProfile);
router.patch('/profile', authController.updateProfile);
router.post('/change-pin', authController.changePin);

// This is the standard route for any user to change their own password
router.post('/change-password', authController.changePassword);

// This is the explicit admin route you requested. 
// It points to the exact same secure controller method.
router.post('/admin/change-password', authController.changePassword);
router.post('/2fa/setup', authController.setup2FA);
router.post('/2fa/verify', authController.verify2FA);


export default router;