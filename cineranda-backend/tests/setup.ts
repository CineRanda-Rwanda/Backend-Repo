import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Increase timeout and add better error handling
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'test',
      launchTimeout: 120000, // 2 minutes to start MongoDB instance
    },
    binary: {
      version: '7.0.24',
      downloadDir: './mongodb-binaries', // Cache downloaded binary
    },
  });
  
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Test database connected');
}, 180000); // 3 minute timeout for beforeAll

afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  // Ensure all operations complete before closing
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  console.log('✅ Test database disconnected');
}, 60000); // 60 second timeout for afterAll