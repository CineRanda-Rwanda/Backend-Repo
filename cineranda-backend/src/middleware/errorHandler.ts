import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Different error response for development vs production
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    // For production, only send operational errors to client
    // For programming or other unknown errors, send generic message
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // Log error for debugging in production
      console.error('ERROR 💥', err);
      
      // Send generic message
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
    }
  }
};

export default errorHandler;