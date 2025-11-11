import { User, IUser } from '../../src/data/models/user.model';
import { Content, IContent } from '../../src/data/models/movie.model';
import { Genre, IGenre } from '../../src/data/models/genre.model';
import { Category, ICategory } from '../../src/data/models/category.model';
import jwt from 'jsonwebtoken';
import config from '../../src/config';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';

export class TestHelpers {
  /**
   * Create authenticated user with token
   */
  static async createTestUser(overrides: any = {}): Promise<{ user: IUser & { _id: Types.ObjectId }; token: string }> {
    const hashedPin = await bcrypt.hash('1234', 10);
    
    const user = await User.create({
      username: `user_${Date.now()}`,
      phoneNumber: `+25079${Math.floor(Math.random() * 10000000)}`,
      pin: hashedPin,
      role: 'user',
      location: 'international',
      isActive: true,
      phoneVerified: true,
      balance: 10000,
      coinWallet: {
        balance: 500,
        transactions: []
      },
      ...overrides,
    });

    const token = jwt.sign(
      { userId: (user._id as any).toString(), role: user.role, username: user.username },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    return { user: user as any, token };
  }

  /**
   * Create admin user
   */
  static async createAdminUser(): Promise<{ admin: IUser & { _id: Types.ObjectId }; token: string }> {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    const hashedPin = await bcrypt.hash('1234', 10);

    const admin = await User.create({
      username: `admin_${Date.now()}`,
      email: `admin${Date.now()}@test.com`,
      phoneNumber: `+25078${Math.floor(Math.random() * 10000000)}`,
      password: hashedPassword,
      pin: hashedPin,
      role: 'admin',
      location: 'international',
      isActive: true,
      phoneVerified: true,
      isEmailVerified: true,
      balance: 50000,
    });

    const token = jwt.sign(
      { userId: (admin._id as any).toString(), role: admin.role, username: admin.username },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    return { admin: admin as any, token };
  }

  /**
   * Create test genre
   */
  static async createTestGenre(): Promise<IGenre & { _id: Types.ObjectId }> {
    const genre = await Genre.create({
      name: `Genre_${Date.now()}`,
      description: 'Test genre',
      isActive: true,
    });
    return genre as any;
  }

  /**
   * Create test category
   */
  static async createTestCategory(): Promise<ICategory & { _id: Types.ObjectId }> {
    const category = await Category.create({
      name: `Category_${Date.now()}`,
      description: 'Test category',
      isActive: true,
      isFeature: false,
    });
    return category as any;
  }

  /**
   * Create test movie
   */
  static async createTestMovie(overrides: any = {}): Promise<IContent & { _id: Types.ObjectId }> {
    const genre = await this.createTestGenre();
    const category = await this.createTestCategory();

    const movie = await Content.create({
      title: `Movie_${Date.now()}`,
      description: 'Test movie description',
      contentType: 'Movie',
      posterImageUrl: 'https://test.com/poster.jpg',
      movieFileUrl: 'https://test.com/movie.mp4',
      duration: 7200,
      priceInRwf: 1000,
      priceInCoins: 10,
      releaseYear: 2024,
      isPublished: true,
      genres: [genre._id],
      categories: [category._id],
      ...overrides,
    });
    return movie as any;
  }

  /**
   * Create test series with episodes
   */
  static async createTestSeries(episodeCount: number = 3, overrides: any = {}): Promise<IContent & { _id: Types.ObjectId }> {
    const genre = await this.createTestGenre();
    const category = await this.createTestCategory();

    const episodes = [];
    for (let i = 1; i <= episodeCount; i++) {
      episodes.push({
        episodeNumber: i,
        title: `Episode ${i}`,
        description: `Test episode ${i}`,
        videoUrl: `https://test.com/ep${i}.mp4`,
        duration: 3600,
        thumbnailUrl: `https://test.com/thumb${i}.jpg`,
        isFree: false,
        priceInRwf: 500,
        priceInCoins: 5,
      });
    }

    const series = await Content.create({
      title: `Series_${Date.now()}`,
      description: 'Test series',
      contentType: 'Series',
      posterImageUrl: 'https://test.com/poster.jpg',
      releaseYear: 2024,
      isPublished: true,
      genres: [genre._id],
      categories: [category._id],
      seriesDiscountPercent: 15,
      seasons: [
        {
          seasonNumber: 1,
          seasonTitle: 'Season 1',
          episodes: episodes,
        },
      ],
      ...overrides,
    });
    return series as any;
  }

  /**
   * Purchase content for user
   */
  static async purchaseContent(userId: string, contentId: string, episodeIds: string[] = []): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $push: {
        purchasedContent: {
          contentId: contentId,
          purchaseDate: new Date(),
          price: 1000,
          currency: 'RWF',
          episodeIdsAtPurchase: episodeIds,
        },
      } as any,
    });
  }

  /**
   * Purchase episode for user
   */
  static async purchaseEpisode(userId: string, contentId: string, episodeId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $push: {
        purchasedEpisodes: {
          contentId: contentId,
          episodeId: episodeId,
          purchaseDate: new Date(),
          price: 500,
          currency: 'RWF',
        },
      } as any,
    });
  }

  /**
   * Add episode to series
   */
  static async addEpisodeToSeries(seriesId: string, seasonNumber: number, episodeData: any): Promise<any> {
    const series = await Content.findById(seriesId);
    if (!series) throw new Error('Series not found');
    if (!series.seasons) throw new Error('No seasons found');

    const season = series.seasons.find((s: any) => s.seasonNumber === seasonNumber);
    if (!season) throw new Error('Season not found');

    const newEpisode = {
      episodeNumber: episodeData.episodeNumber || season.episodes.length + 1,
      title: episodeData.title || 'New Episode',
      description: episodeData.description || 'New episode description',
      videoUrl: episodeData.videoUrl || 'https://test.com/new.mp4',
      duration: episodeData.duration || 3600,
      thumbnailUrl: episodeData.thumbnailUrl || 'https://test.com/new-thumb.jpg',
      isFree: episodeData.isFree || false,
      priceInRwf: episodeData.priceInRwf || 500,
      priceInCoins: episodeData.priceInCoins || 5,
    };

    season.episodes.push(newEpisode as any);
    await series.save();

    return season.episodes[season.episodes.length - 1];
  }
}