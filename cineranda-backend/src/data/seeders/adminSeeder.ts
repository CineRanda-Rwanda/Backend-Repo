import { User } from '../models/user.model';
import { connectDB } from '../databaseConnection';
import dotenv from 'dotenv';

// Load environment variables from the root .env file
dotenv.config({ path: '../../.env' });

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = "nsabagasaniemm3@gmail.com";
    const adminPassword = "#Emmanuel123#";
    const adminUsername = "super_admin";
    const adminPhoneNumber = "250700000000"; // A placeholder phone number

    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      console.log('Default admin user not found, creating one...');
      await User.create({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword, // The pre-save hook will hash this
        phoneNumber: adminPhoneNumber,
        pin: '0000', // A placeholder PIN is still required by the schema
        role: 'admin',
        isActive: true,
        isEmailVerified: true, // We assume the default admin is verified
      });
      console.log('Default admin user created successfully.');
    } else {
      console.log('Default admin user already exists.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    process.exit();
  }
};

seedAdmin();