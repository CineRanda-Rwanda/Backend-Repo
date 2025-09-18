import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include geolocation data
declare global {
  namespace Express {
    interface Request {
      clientIp?: string;
      geoData?: {
        ip: string;
        country: string;
        countryCode: string;
        region: string;
        city: string;
      };
    }
  }
}

export const detectUserLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || 
               req.socket.remoteAddress || 
               '127.0.0.1';
    
    // Store IP in request
    req.clientIp = ip as string;
    
    // In a production app, you would use a geolocation API service
    // For now, we'll use a simplified approach with hardcoded values
    
    // Add location data to request
    req.geoData = {
      ip: ip as string,
      country: 'Rwanda', // Default for testing
      countryCode: 'rw',
      region: 'rwanda',
      city: 'Kigali'
    };
    
    next();
  } catch (error) {
    // Don't block the request if location detection fails
    console.error('Location detection error:', error);
    
    // Use default values
    req.geoData = {
      ip: req.ip || '127.0.0.1',
      country: 'Unknown',
      countryCode: 'unknown',
      region: 'international',
      city: 'Unknown'
    };
    
    next();
  }
};