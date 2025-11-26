import { app } from './app';
import config from './config';
import databaseConnection from './data/databaseConnection'; // Uncomment this

// Start server with database connection
const startServer = async () => {
  try {
    // Connect to database
    await databaseConnection.connect();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    // We continue to start the server so that health checks can pass
    // and we can see the logs in Vercel
  }

  try {
    // Start the server
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.env} mode`);
      console.log(`API available at: http://localhost:${config.port}${config.apiPrefix}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      console.error(`Unhandled Rejection: ${err.message}`);
      // Log error but don't exit process in serverless environment
      // server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    // process.exit(1);
  }
};

startServer();