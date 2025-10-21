import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../data/models/user.model';
import AppError from '../utils/AppError';
import config from '../config';
import mongoose from 'mongoose';

// JWT payload interface remains unchanged
interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

// Keep your interface definition as is
export interface AuthRequest extends Request {
  user?: IUser & {
    _id: mongoose.Types.ObjectId;
  };
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

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const currentUser = await User.findById(decoded.userId);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.isActive === false) {
      return next(new AppError('Your account has been deactivated', 403));
    }

    if (currentUser.pendingVerification && currentUser.role !== 'admin') {
      return next(new AppError('Account verification pending. Please complete verification.', 403));
    }

    // Use type assertion to tell TypeScript this is the correct type
    req.user = currentUser as unknown as (IUser & { _id: mongoose.Types.ObjectId });
    
    next();
  } catch (error) {
    // Error handling remains unchanged
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
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

/**
 * Middleware to authorize users based on roles.
 * @param allowedRoles - Array of roles that are allowed to access the route.
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // This check relies on the 'authenticate' middleware running first
    if (!req.user || !req.user.role) {
      return next(
        new AppError('Authentication error. User data is missing.', 401)
      );
    }

    const isAllowed = allowedRoles.includes(req.user.role);

    if (!isAllowed) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    // If the user's role is in the allowed list, proceed.
    next();
  };
};