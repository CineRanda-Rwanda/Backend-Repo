import mongoose from 'mongoose';
import config from '../config';

const connect = async (): Promise<typeof mongoose> => {
  try {
    // Connect to MongoDB with additional options
    const connection = await mongoose.connect(config.mongodb.uri, {
      // Add options to help with DNS resolution
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    });
    
    console.log(`MongoDB connected: ${connection.connection.host}`);
    
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// For test environments, add a disconnect method
const disconnect = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') {
    await mongoose.connection.close();
  }
};

export default {
  connect,
  disconnect
};