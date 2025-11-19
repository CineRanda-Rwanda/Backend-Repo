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
app.use(helmet());
app.use(cors());
app.use(express.json()); // This line is critical
app.use(express.urlencoded({ extended: true }));
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