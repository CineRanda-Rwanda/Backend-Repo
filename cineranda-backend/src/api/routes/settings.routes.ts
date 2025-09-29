import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';

const router = Router();
const settingsController = new SettingsController();

// GET /api/v1/settings - Get current settings (Admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  settingsController.getSettings
);

// PATCH /api/v1/settings - Update settings (Admin only)
router.patch(
  '/',
  authenticate,
  authorize(['admin']),
  settingsController.updateSettings
);

export default router;