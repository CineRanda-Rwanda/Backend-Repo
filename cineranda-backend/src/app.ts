import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import routes from './api/routes';
import errorHandler from './middleware/errorHandler';
import requestLogger from './middleware/requestLogger';
import { detectUserLocation } from './middleware/location.middleware';
import userRoutes from './api/routes/user.routes';
import settingsRoutes from './api/routes/settings.routes';

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

// API routes
app.use(config.apiPrefix, routes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingsRoutes);

// Error handling middleware
app.use(errorHandler);

export { app };