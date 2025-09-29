import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../../data/models/user.model';
import AppError from '../../utils/AppError';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Define AuthRequest interface
interface AuthRequest extends Request {
  user: IUser & { _id: mongoose.Types.ObjectId | string };
}

export class UserController {
  // Get all users with pagination and filtering
  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Build filter object based on query params
      const filter: any = {};
      
      if (req.query.username) {
        filter.username = { $regex: req.query.username, $options: 'i' };
      }
      
      if (req.query.phoneNumber) {
        filter.phoneNumber = { $regex: req.query.phoneNumber, $options: 'i' };
      }
      
      if (req.query.role) {
        filter.role = req.query.role;
      }
      
      // Execute query with pagination
      const users = await User.find(filter)
        .select('-pin')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
      
      // Get total count for pagination
      const total = await User.countDocuments(filter);
      
      res.status(200).json({
        status: 'success',
        results: users.length,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        },
        data: {
          users
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get single user by ID
  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.params.id).select('-pin');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user by phone number
  getUserByPhone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.query;
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return next(new AppError('Valid phone number is required', 400));
      }
      
      const user = await User.findOne({ phoneNumber }).select('-pin');
      
      if (!user) {
        return next(new AppError('No user found with that phone number', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Update user's role
  updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Prevent users from removing their own admin role
      if (req.params.id === (req as any).user._id.toString() && 
          req.body.role !== 'admin' && 
          (req as any).user.role === 'admin') {
        return next(new AppError('You cannot remove your own admin role', 403));
      }
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: req.body.role },
        { new: true, runValidators: true }
      ).select('-pin');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Toggle user active status (ban/unban)
  toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return next(new AppError('isActive must be a boolean', 400));
      }
      
      // Prevent self-banning
      if (req.params.id === (req as any).user._id.toString() && isActive === false) {
        return next(new AppError('You cannot deactivate your own account', 403));
      }
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive },
        { new: true }
      ).select('-pin');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Reset user's PIN
  resetUserPIN = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { newPin } = req.body;
      
      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        return next(new AppError('PIN must be exactly 4 digits', 400));
      }
      
      const hashedPin = await bcrypt.hash(newPin, 12);
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { pin: hashedPin },
        { new: true }
      ).select('-pin');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        message: 'PIN reset successful',
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Adjust user's coin balance
  adjustCoins = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, description } = req.body;
      
      if (typeof amount !== 'number') {
        return next(new AppError('Amount must be a number', 400));
      }
      
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      // Initialize coinWallet if it doesn't exist
      if (!user.coinWallet) {
        user.coinWallet = { 
          balance: 0, 
          transactions: [] 
        };
      }
      
      // Add transaction
      user.coinWallet.balance += amount;
      user.coinWallet.transactions.push({
        amount,
        type: 'admin-adjustment',
        description: description || 'Admin adjustment',
        createdAt: new Date()
      });
      
      await user.save();
      
      res.status(200).json({
        status: 'success',
        data: {
          user: {
            _id: user._id,
            username: user.username,
            coinWallet: {
              balance: user.coinWallet.balance
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's transaction history
  getUserTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.params.id).select('coinWallet');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          balance: user.coinWallet?.balance || 0,
          transactions: user.coinWallet?.transactions || []
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete user
  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === (req as AuthRequest).user._id.toString()) {
        return next(new AppError('You cannot delete your own account through this endpoint', 403));
      }
      
      const user = await User.findByIdAndDelete(id);
      
      if (!user) {
        return next(new AppError('No user found with that ID', 404));
      }
      
      res.status(204).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };
}