import { app } from '../src/app';
import databaseConnection from '../src/data/databaseConnection';

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  // Ensure database connection is established
  try {
    await databaseConnection.connect();
  } catch (error) {
    console.error('Database connection failed', error);
    // We don't exit here, allowing the app to handle the error or return 500
  }
  
  // Forward request to Express app
  app(req, res);
}

