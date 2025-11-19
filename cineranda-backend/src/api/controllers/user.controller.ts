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
      let { phoneNumber } = req.query;
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return next(new AppError('Valid phone number is required', 400));
      }
      
      // Normalize phone number format (ensure it has + prefix)
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = `+${phoneNumber}`;
      }
      
      // Log for debugging
      console.log(`Searching for user with phone number: ${phoneNumber}`);
      
      // Try to find the user
      const user = await User.findOne({ phoneNumber }).select('-pin');
      
      if (!user) {
        // For debugging, check how many users exist
        const userCount = await User.countDocuments();
        console.log(`No user found with phone ${phoneNumber}. Total users: ${userCount}`);
        
        return next(new AppError('No user found with that phone number', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Error in getUserByPhone:', error);
      next(error);
    }
  };

  // Update user details (admin only)
  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, isActive, role } = req.body;
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (role !== undefined) updateData.role = role;
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-pin');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: user
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
      
      // Initialize wallet if it doesn't exist
      if (!user.wallet) {
        user.wallet = { 
          balance: 0,
          bonusBalance: 0, 
          transactions: [] 
        };
      }
      
      // Add to bonusBalance (admin adjustments go to bonus)
      user.wallet.bonusBalance += amount;
      user.wallet.transactions.push({
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
            wallet: {
              balance: user.wallet.balance,
              bonusBalance: user.wallet.bonusBalance,
              totalBalance: (user.wallet.balance || 0) + (user.wallet.bonusBalance || 0)
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Adjust user's unified wallet balance (credit/debit)
  adjustBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, type, category, description } = req.body;

      if (typeof amount !== 'number' || amount <= 0) {
        return next(new AppError('Amount must be a positive number', 400));
      }

      if (!['credit', 'debit'].includes(type)) {
        return next(new AppError('Type must be either "credit" or "debit"', 400));
      }

      const user = await User.findById(req.params.id);
      if (!user) return next(new AppError('User not found', 404));

      // Debug logging
      // Ensure wallet exists
      if (!user.wallet) {
        (user as any).wallet = { balance: 0, bonusBalance: 0, transactions: [] };
      }

      // Map category to valid transaction type
      const validTypes = ['welcome-bonus', 'admin-adjustment', 'purchase', 'refund', 'topup', 'bonus'];
      let transactionType = category || 'admin-adjustment';
      
      // Handle common aliases/corrections
      if (transactionType === 'adjustment') {
        transactionType = 'admin-adjustment';
      }
      
      // Validate transaction type
      if (!validTypes.includes(transactionType)) {
        return next(new AppError(`Invalid category. Must be one of: ${validTypes.join(', ')}`, 400));
      }

      if (type === 'credit') {
        const asBonus = transactionType === 'bonus';
        await (user as any).addToWallet(amount, transactionType, description || 'Admin adjustment', asBonus);
      } else {
        // debit
        try {
          await (user as any).deductFromWallet(amount, transactionType, description || 'Admin adjustment');
        } catch (err: any) {
          return next(new AppError(err.message || 'Insufficient balance', 400));
        }
      }

      const updated = await User.findById(req.params.id).select('wallet');

      res.status(200).json({
        status: 'success',
        data: {
          userId: req.params.id,
          wallet: updated?.wallet || { balance: 0, bonusBalance: 0 },
          newBalance: (updated?.wallet?.balance || 0) + (updated?.wallet?.bonusBalance || 0)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's transaction history
  getUserTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.params.id).select('wallet');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          balance: user.wallet?.balance || 0,
          bonusBalance: user.wallet?.bonusBalance || 0,
          totalBalance: (user.wallet?.balance || 0) + (user.wallet?.bonusBalance || 0),
          transactions: user.wallet?.transactions || []
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete user (soft delete - deactivate)
  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === (req as AuthRequest).user._id.toString()) {
        return next(new AppError('You cannot delete your own account through this endpoint', 403));
      }
      
      // Soft delete: set isActive to false instead of permanently deleting
      const user = await User.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
      
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