import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../data/models/user.model';
import AppError from '../utils/AppError';
import config from '../config'; // Use the config file for secrets

// This interface will be used by all authenticated routes
interface AuthRequest extends Request {
  user?: IUser; // Use the IUser interface
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // --- THIS IS THE FIX ---
    // The token payload contains 'userId', not 'id'. We need to look for the correct property.
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };

    // Use the correct property from the decoded token
    const currentUser = await User.findById(decoded.userId);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again.', 401));
  }
};

/**
 * Middleware to restrict access to admin users only.
 */
export const restrictToAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  
  next();
};