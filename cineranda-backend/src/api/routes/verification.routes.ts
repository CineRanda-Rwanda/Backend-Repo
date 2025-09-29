import { Router } from 'express';
import { VerificationController } from '../controllers/verification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const verificationController = new VerificationController();

// Send verification code
router.post(
  '/send-code',
  authenticate,
  verificationController.sendVerificationCode
);

// Verify code
router.post(
  '/verify',
  authenticate,
  verificationController.verifyPhoneNumber
);

export default router;