import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../data/models/user.model';

dotenv.config();

async function dropLegacyIndexes() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Please add it to your environment before running this script.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    const indexes = await User.collection.indexes();
    const targets = ['username_1', 'phoneNumber_1', 'email_1'];

    for (const indexName of targets) {
      const exists = indexes.find((index) => index.name === indexName);
      if (exists) {
        await User.collection.dropIndex(indexName);
        console.log(`Dropped ${indexName} index successfully.`);
      } else {
        console.log(`${indexName} index does not exist. No action needed.`);
      }
    }
  } catch (error) {
    console.error('Failed to drop legacy indexes:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

dropLegacyIndexes().catch((error) => {
  console.error('Unexpected error while dropping legacy indexes:', error);
  process.exitCode = 1;
});
