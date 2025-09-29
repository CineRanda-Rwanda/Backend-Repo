import { Request, Response, NextFunction } from 'express';
import { Settings } from '../../data/models/settings.model';
import AppError from '../../utils/AppError';

export class SettingsController {
  // Get current settings
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let settings = await Settings.findOne();
      
      // Create default settings if none exist
      if (!settings) {
        settings = await Settings.create({ welcomeBonusAmount: 100 });
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          settings
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Update settings
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { welcomeBonusAmount } = req.body;
      
      // Validate welcome bonus amount
      if (welcomeBonusAmount !== undefined) {
        if (typeof welcomeBonusAmount !== 'number' || welcomeBonusAmount < 0) {
          return next(new AppError('Welcome bonus amount must be a non-negative number', 400));
        }
      }
      
      let settings = await Settings.findOne();
      
      // Create or update settings
      if (!settings) {
        settings = await Settings.create({ 
          welcomeBonusAmount: welcomeBonusAmount ?? 100 
        });
      } else {
        // Update only provided fields
        if (welcomeBonusAmount !== undefined) {
          settings.welcomeBonusAmount = welcomeBonusAmount;
        }
        await settings.save();
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          settings
        }
      });
    } catch (error) {
      next(error);
    }
  };
}