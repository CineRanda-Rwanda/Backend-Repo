import { app } from '../src/app';
import databaseConnection from '../src/data/databaseConnection';

export default async function handler(req: any, res: any) {
  try {
    await databaseConnection.connect();
  } catch (error) {
    console.error('Database connection failed', error);
  }
  
  app(req, res);
}
