import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import routes from './api/routes';
import errorHandler from './middleware/errorHandler';
import requestLogger from './middleware/requestLogger';
import { detectUserLocation } from './middleware/location.middleware';

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      config.clientUrl,
      'http://localhost:3000',
      'https://frontend-repo-ecru.vercel.app',
      'https://cineranda.vercel.app'
    ];
    
    // Check if the origin is allowed
    if (
      allowedOrigins.indexOf(origin) !== -1 || 
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json()); // This line is critical
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use(requestLogger);

// Apply location detection to all routes
app.use(detectUserLocation);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes - All routes are registered in routes/index.ts
app.use(config.apiPrefix, routes);

// Error handling middleware
app.use(errorHandler);

export { app };