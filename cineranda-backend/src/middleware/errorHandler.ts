import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  // Handle MongoDB duplicate key errors (code 11000)
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error.keyValue || {})[0] || 'field';
    const duplicatedValue = error.keyValue?.[duplicatedField];
    const message = `The ${duplicatedField} "${duplicatedValue}" is already in use. Please choose a different ${duplicatedField}.`;
    error = new AppError(message, 400);
  }

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Different error response for development vs production
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      status: error.status,
      error,
      message: error.message,
      stack: error.stack
    });
  } else {
    // For production, only send operational errors to client
    // For programming or other unknown errors, send generic message
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message
      });
    } else {
      // Log error for debugging in production
      console.error('ERROR 💥', error);
      
      // Send generic message
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
    }
  }
};

export default errorHandler;