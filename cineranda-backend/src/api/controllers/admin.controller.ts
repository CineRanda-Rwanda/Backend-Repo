import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../../data/models/user.model'; // Import IUser
import AppError from '../../utils/AppError';

// This interface now correctly types the user property
interface AuthRequest extends Request {
  user?: IUser; // Use the IUser interface for type safety
}

export class AdminController {
  /**
   * Admin creates a new admin account.
   */
  createAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, phoneNumber, pin } = req.body;
      // Basic validation
      if (!username || !email || !password || !phoneNumber || !pin) {
        return next(new AppError('Please provide all required fields for the new admin.', 400));
      }

      // Check if an admin with this email already exists
      const existingAdmin = await User.findOne({ email });
      if (existingAdmin) {
        return next(new AppError('An account with this email already exists.', 409));
      }

      // Create the new admin with only the expected fields for security
      const newAdmin = await User.create({
        username,
        email,
        password,
        phoneNumber,
        pin,
        role: 'admin', // Force the role to be 'admin'
      });

      const adminObject = newAdmin.toObject();
      // The password and pin are already excluded by `select: false` in the schema,
      // so they won't be in the object to delete.

      res.status(201).json({
        status: 'success',
        message: 'New admin account created successfully.',
        data: {
          user: adminObject,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Admin grants a user free access to a specific movie.
   */
  grantFreeAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, contentId } = req.body;
      const user = await User.findById(userId);
      // In a real app, you would also check if the contentId is a valid movie
      if (!user) {
        return next(new AppError('User not found.', 404));
      }

      // Add the movie to the user's purchasedContent array
      user.purchasedContent = user.purchasedContent || [];
      user.purchasedContent.push({
        contentId: contentId,
        purchaseDate: new Date(),
        price: 0, // Price is 0 for free access
        currency: 'BONUS',
      });

      await user.save();

      res.status(200).json({
        status: 'success',
        message: `Successfully granted access to user ${user.username}.`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Placeholder for analytics dashboard data.
   */
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // This is where you would build complex aggregation pipelines
      const totalUsers = await User.countDocuments();
      const totalMovies = 0; // Replace with: await Movie.countDocuments();
      const totalRevenue = 0; // Replace with aggregation from Purchase model

      res.status(200).json({
        status: 'success',
        data: {
          totalUsers,
          totalMovies,
          totalRevenue,
          // Add more analytics data here
        },
      });
    } catch (error) {
      next(error);
    }
  };
}