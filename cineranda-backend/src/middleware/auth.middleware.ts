import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import config from '../config';
import { UserRepository } from '../data/repositories/user.repository';

// Extend Express Request to include user information
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

const userRepository = new UserRepository();

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1) Check if token exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication required', 401));
    }

    // 2) Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as { 
      userId: string;
      role: string;
      location: string;
    };

    // 3) Check if user exists
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // 4) Check if user is still active
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 401));
    }

    // 5) Grant access
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return next(new AppError('Authentication failed', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    
    next();
  };
};