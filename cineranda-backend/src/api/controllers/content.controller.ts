import { Request, Response, NextFunction } from 'express';
import { S3Service } from '../../core/services/s3.service';
import { Content } from '../../data/models/movie.model';
import AppError from '../../utils/AppError';
import { MovieRepository } from '../../data/repositories/movie.repository';
import { GenreRepository } from '../../data/repositories/genre.repository';
import { CategoryRepository } from '../../data/repositories/category.repository';
import { WatchHistoryRepository } from '../../data/repositories/watchHistory.repository';
import { AuthRequest } from '../../middleware/auth.middleware';

export class ContentController {
  private s3Service: S3Service;
  private movieRepository: MovieRepository;
  private genreRepository: GenreRepository;
  private categoryRepository: CategoryRepository;
  private watchHistoryRepository: WatchHistoryRepository;

  constructor() {
    this.s3Service = new S3Service();
    this.movieRepository = new MovieRepository();
    this.genreRepository = new GenreRepository();
    this.categoryRepository = new CategoryRepository();
    this.watchHistoryRepository = new WatchHistoryRepository();
  }

  /**
   * HELPER: Sign all S3 URLs in a content object
   * This preserves all existing data and only adds signed URLs
   */
  private async signContentUrls(content: any): Promise<any> {
    const signedContent = { ...content };

    try {
      // Sign poster image (24 hours)
      if (signedContent.posterImageUrl) {
        signedContent.posterImageUrl = await this.s3Service.getSignedUrl(
          signedContent.posterImageUrl,
          86400
        );
      }

      // Sign movie file URL if it's a movie (2 hours)
      if (signedContent.contentType === 'Movie' && signedContent.movieFileUrl) {
        signedContent.movieFileUrl = await this.s3Service.getSignedUrl(
          signedContent.movieFileUrl,
          7200
        );
      }

      // Sign movie subtitles (24 hours)
      if (signedContent.subtitles) {
        signedContent.subtitles = await this.s3Service.signSubtitles(
          signedContent.subtitles,
          86400
        );
      }

      // Sign series episodes (videos, thumbnails, subtitles)
      if (signedContent.contentType === 'Series' && signedContent.seasons) {
        for (const season of signedContent.seasons) {
          if (season.episodes) {
            for (const episode of season.episodes) {
              // Sign episode video (2 hours)
              if (episode.videoUrl) {
                episode.videoUrl = await this.s3Service.getSignedUrl(
                  episode.videoUrl,
                  7200
                );
              }

              // Sign episode thumbnail (24 hours)
              if (episode.thumbnailUrl) {
                episode.thumbnailUrl = await this.s3Service.getSignedUrl(
                  episode.thumbnailUrl,
                  86400
                );
              }

              // Sign episode subtitles (24 hours)
              if (episode.subtitles) {
                episode.subtitles = await this.s3Service.signSubtitles(
                  episode.subtitles,
                  86400
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error signing content URLs:', error);
    }

    return signedContent;
  }

  /**
   * HELPER: Sign URLs for an array of content
   */
  private async signContentArray(contentArray: any[]): Promise<any[]> {
    return Promise.all(
      contentArray.map(async (item) => {
        const obj = item.toObject ? item.toObject() : item;
        return this.signContentUrls(obj);
      })
    );
  }

  createContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};
      
      console.log('Creating content with body:', req.body); // Debug what's being received
    
      // Check if title is provided
      if (!req.body.title) {
        return next(new AppError('Title is required.', 400));
      }
      
      // Validate content type
      const contentType = req.body.contentType;
      if (contentType !== 'Movie' && contentType !== 'Series') {
        return next(new AppError('Content type must be either "Movie" or "Series".', 400));
      }
      
      // Poster image is required for both types
      if (!files.posterImage || !files.posterImage[0]) {
        return next(new AppError('Poster image is required.', 400));
      }
      
      // Only require movie file for 'Movie' content type
      if (contentType === 'Movie') {
        if (!files.movieFile || !files.movieFile[0]) {
          return next(new AppError('Movie file is required for content type "Movie".', 400));
        }
      }
      
      // Upload poster image
      const posterImageUrl = await this.s3Service.uploadFile(
        files.posterImage[0],
        'posters'
      );
      
      // Create content object
      const content: any = {
        title: req.body.title,
        description: req.body.description,
        contentType,
        posterImageUrl,
        isPublished: req.body.isPublished === 'true',
        trailerYoutubeLink: req.body.trailerYoutubeLink,
      };
      
      // Add pricing if provided
      if (req.body.priceInRwf) {
        content.priceInRwf = parseInt(req.body.priceInRwf, 10);
      }
      if (req.body.priceInCoins) {
        content.priceInCoins = parseInt(req.body.priceInCoins, 10);
      }
      
      // Handle new fields: genres, categories, cast, releaseYear
      // Parse genres array
      if (req.body.genres) {
        try {
          content.genres = typeof req.body.genres === 'string' 
            ? JSON.parse(req.body.genres) 
            : req.body.genres;
        } catch (e) {
          console.log('Error parsing genres:', e);
          content.genres = [req.body.genres]; // Fallback to single value
        }
      }
      
      // Parse categories array
      if (req.body.categories) {
        try {
          content.categories = typeof req.body.categories === 'string' 
            ? JSON.parse(req.body.categories) 
            : req.body.categories;
        } catch (e) {
          console.log('Error parsing categories:', e);
          content.categories = [req.body.categories]; // Fallback to single value
        }
      }
      
      // Parse cast array
      if (req.body.cast) {
        try {
          content.cast = typeof req.body.cast === 'string' 
            ? (req.body.cast.startsWith('[') ? JSON.parse(req.body.cast) : req.body.cast.split(',').map((c: string) => c.trim()))
            : req.body.cast;
        } catch (e) {
          console.log('Error parsing cast:', e);
          content.cast = [req.body.cast]; // Fallback to single value
        }
      }
      
      // Handle releaseYear
      if (req.body.releaseYear) {
        content.releaseYear = parseInt(req.body.releaseYear, 10);
      }
      
      // Content type specific processing
      if (contentType === 'Movie') {
        // Movie specific - add movie file and subtitles
        const movieFileUrl = await this.s3Service.uploadFile(
          files.movieFile[0],
          'movies'
        );
        content.movieFileUrl = movieFileUrl;
        
        // Add subtitles if provided
        const subtitles: { en?: string; fr?: string; kin?: string } = {};
        
        if (files.subtitleEn?.[0]) {
          subtitles.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
        }
        if (files.subtitleFr?.[0]) {
          subtitles.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
        }
        if (files.subtitleKin?.[0]) {
          subtitles.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
        }
        
        if (Object.keys(subtitles).length > 0) {
          content.subtitles = subtitles;
        }
        
        if (req.body.duration) {
          content.duration = parseInt(req.body.duration, 10);
        }
        
        // Additional movie fields
        if (req.body.director) {
          content.director = req.body.director;
        }
        if (req.body.language) {
          content.language = req.body.language;
        }
        if (req.body.ageRating) {
          content.ageRating = req.body.ageRating;
        }
      } else {
        // Series specific - handle seasons
        console.log('⭐ PROCESSING SERIES - START ⭐');
        try {
          // ✅ ADDED: Handle series discount percentage
          if (req.body.seriesDiscountPercent) {
            content.seriesDiscountPercent = parseFloat(req.body.seriesDiscountPercent);
            console.log(`Series discount set to: ${content.seriesDiscountPercent}%`);
          }
          
          if (req.body.seasons) {
            console.log('Seasons data received:', req.body.seasons);
            console.log('Seasons data type:', typeof req.body.seasons);
            
            let seasons;
            try {
              // More robust seasons parsing
              if (typeof req.body.seasons === 'string') {
                console.log('Parsing seasons from string');
                seasons = JSON.parse(req.body.seasons);
                console.log('Parsed seasons result:', seasons);
              } else {
                console.log('Using seasons as-is (already an object)');
                seasons = req.body.seasons;
              }
              
              if (Array.isArray(seasons)) {
                console.log('Seasons is a valid array with length:', seasons.length);
                content.seasons = seasons;
              } else {
                console.log('Seasons is not an array, defaulting to empty array');
                content.seasons = [];
              }
            } catch (parseError) {
              console.error('❌ Error parsing seasons JSON:', parseError);
              content.seasons = [];
            }
          } else {
            console.log('No seasons data provided, defaulting to empty array');
            content.seasons = [];
          }
          
          console.log('✅ SERIES PROCESSING COMPLETE');
        } catch (e) {
          console.error('❌ Error in series processing:', e);
          content.seasons = [];
        }
      }
      
      console.log('About to create content:', content); // Debug content object
    
      // Save content
      const newContent = await Content.create(content);
      
      // Sign URLs before returning
      const contentObj = newContent.toObject();
      const signedContent = await this.signContentUrls(contentObj);
      
      res.status(201).json({
        status: 'success',
        data: { content: signedContent }
      });
    } catch (error) {
      console.error('Error creating content:', error);
      next(error);
    }
  };

  updateContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const contentToUpdate = await Content.findById(id);

      if (!contentToUpdate) {
        return next(new AppError('No content found with that ID', 404));
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const updates = { ...req.body };

      // Handle poster image replacement
      if (files.posterImage?.[0]) {
        // We can safely delete the poster because it's a required field
        await this.s3Service.deleteFile(contentToUpdate.posterImageUrl);
        updates.posterImageUrl = await this.s3Service.uploadFile(files.posterImage[0], 'posters');
      }

      // Handle movie file replacement
      if (files.movieFile?.[0] && contentToUpdate.contentType === 'Movie') {
        // --- FIX: Check if movieFileUrl exists before trying to delete it ---
        if (contentToUpdate.movieFileUrl) {
          await this.s3Service.deleteFile(contentToUpdate.movieFileUrl);
        }
        updates.movieFileUrl = await this.s3Service.uploadFile(files.movieFile[0], 'movies');
      }

      // (We can add subtitle replacement logic here later if needed)

      const updatedContent = await Content.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });

      // Sign URLs before returning
      if (!updatedContent) {
        return next(new AppError('Failed to update content', 500));
      }

      const contentObj = updatedContent.toObject();
      const signedContent = await this.signContentUrls(contentObj);

      res.status(200).json({
        status: 'success',
        message: 'Content updated successfully.',
        data: { content: signedContent }
      });
    } catch (error) {
      next(error);
    }
  };

  deleteContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const contentToDelete = await Content.findById(id);

      if (!contentToDelete) {
        return next(new AppError('No content found with that ID', 404));
      }

      // --- [DEBUG] Log the entire object we are about to delete ---
      console.log('--- [DEBUG] Content to delete: ---', JSON.stringify(contentToDelete, null, 2));

      // --- Delete all associated files from S3 ---
      // 1. Delete poster image
      await this.s3Service.deleteFile(contentToDelete.posterImageUrl);

      // 2. Delete movie file (if it's a movie and the URL exists)
      if (contentToDelete.contentType === 'Movie' && contentToDelete.movieFileUrl) {
        console.log(`--- [DEBUG] Attempting to delete movie file: ${contentToDelete.movieFileUrl} ---`);
        await this.s3Service.deleteFile(contentToDelete.movieFileUrl);
      }

      // 3. Delete subtitles (if they exist)
      if (contentToDelete.subtitles) {
        if (contentToDelete.subtitles.en) await this.s3Service.deleteFile(contentToDelete.subtitles.en);
        if (contentToDelete.subtitles.fr) await this.s3Service.deleteFile(contentToDelete.subtitles.fr);
        if (contentToDelete.subtitles.kin) await this.s3Service.deleteFile(contentToDelete.subtitles.kin);
      }
      
      // (We can add logic here later to delete all episode videos for a series)

      // --- Finally, delete the document from MongoDB ---
      await Content.findByIdAndDelete(id);

      // Respond with 204 No Content, which is standard for successful deletions
      res.status(204).json({
        status: 'success',
        data: null,
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a paginated list of all content for the admin dashboard.
   */
  getAllContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const skip = (page - 1) * limit;

      const content = await Content.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const totalContent = await Content.countDocuments();

      // Sign all URLs
      const signedContent = await this.signContentArray(content);

      res.status(200).json({
        status: 'success',
        results: content.length,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalContent / limit),
          totalContent,
        },
        data: { content: signedContent }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get single content by ID (UPDATED: Returns signed URLs)
   * GET /api/v1/content/:id
   */
  getContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = await Content.findById(req.params.id);

      if (!content) {
        return next(new AppError('No content found with that ID', 404));
      }

      const contentObj = content.toObject();
      const signedContent = await this.signContentUrls(contentObj);

      res.status(200).json({
        status: 'success',
        data: { content: signedContent }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all movies with pagination (UPDATED: Returns signed URLs)
   * GET /api/v1/content/movies
   */
  getMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryObj = { contentType: 'Movie', isPublished: true };
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      const totalMovies = await Content.countDocuments(queryObj);
      const movies = await Content.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInRwf priceInCoins genres categories') // ✅ ADDED priceInRwf
        .populate('genres')
        .populate('categories');
    
      // Sign poster URLs
      const signedMovies = await this.signContentArray(movies);

      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit)
        },
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error fetching movies:', error);
      next(error);
    }
  };

  /**
   * Get movie details by ID (UPDATED: Returns signed URLs)
   * GET /api/v1/content/movies/:id
   */
  getMovieDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const movie = await Content.findOne({ _id: id, contentType: 'Movie' })
        .populate('genres')
        .populate('categories');
      
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }

      let isPurchased = false;
      let watchProgress = null;
      
      const authReq = req as AuthRequest;
      if (authReq.user) {
        // Admin always has access
        if (authReq.user.role === 'admin') {
          isPurchased = true;
        } else {
          // Check if user purchased this movie
          const User = require('../data/models/user.model').User;
          const user = await User.findById(authReq.user._id);
          
          if (user) {
            isPurchased = user.purchasedContent?.some(
              (pc: any) => pc.contentId.toString() === id
            );
          }
        }

        // Get watch progress
        const history = await this.watchHistoryRepository.findOne({ 
          user: authReq.user._id, 
          content: id 
        });
        
        if (history) {
          watchProgress = {
            progress: (history as any).progress || 0,
            totalDuration: (history as any).totalDuration,
            lastWatched: history.lastWatched
          };
        }
      }

      const movieObj = movie.toObject();
      const signedMovie = await this.signContentUrls(movieObj);

      res.status(200).json({
        status: 'success',
        data: { 
          movie: signedMovie,
          isPurchased,
          watchProgress
        }
      });
    } catch (error) {
      console.error('Error fetching movie details:', error);
      next(error);
    }
  };

  /**
   * Search movies (UPDATED: Returns signed URLs)
   * GET /api/v1/content/search/movies
   */
  searchMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return next(new AppError('Search query is required', 400));
      }
      
      const movies = await Content.find({
        contentType: 'Movie',
        isPublished: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { cast: { $in: [new RegExp(query as string, 'i')] } }
        ]
      })
      .select('title description posterImageUrl releaseYear priceInRwf priceInCoins') // ✅ Added priceInRwf
      .populate('genres')
      .populate('categories');
      
      const signedMovies = await this.signContentArray(movies);
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error searching movies:', error);
      next(error);
    }
  };

  /**
   * Get featured movies (UPDATED: Returns signed URLs)
   * GET /api/v1/content/featured/movies
   */
  getFeaturedMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const movies = await this.movieRepository.getFeaturedMovies(limit);
      
      const signedMovies = await this.signContentArray(movies);
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        data: { movies: signedMovies }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get content by type (Movie or Series) (UPDATED: Returns signed URLs)
   * GET /api/v1/content/type/:contentType
   */
  getContentByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentType } = req.params;
      
      if (!['Movie', 'Series'].includes(contentType)) {
        return next(new AppError('Invalid content type. Must be Movie or Series', 400));
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      const totalCount = await Content.countDocuments({
        contentType,
        isPublished: true
      });
      
      const content = await Content.find({
        contentType,
        isPublished: true
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title description posterImageUrl releaseYear priceInRwf priceInCoins seasons') // ✅ Added priceInRwf
      .populate('genres')
      .populate('categories');
      
      const signedContent = await this.signContentArray(content);
      
      res.status(200).json({
        status: 'success',
        results: content.length,
        pagination: {
          total: totalCount,
          page,
          pages: Math.ceil(totalCount / limit)
        },
        data: { content: signedContent }
      });
    } catch (error) {
      console.error(`Error fetching ${req.params.contentType}:`, error);
      next(error);
    }
  };

  /**
   * Get movies by genre (UPDATED: Returns signed URLs)
   * GET /api/v1/content/movies/genre/:genreId
   */
  getMoviesByGenre = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { genreId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const genre = await this.genreRepository.findById(genreId);
      if (!genre) {
        return next(new AppError('Genre not found', 404));
      }
      
      const skip = (page - 1) * limit;
      const totalMovies = await Content.countDocuments({ 
        contentType: 'Movie', 
        isPublished: true,
        genres: { $in: [genreId] }
      });
      
      const movies = await Content.find({ 
        contentType: 'Movie',
        isPublished: true,
        genres: { $in: [genreId] }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInRwf priceInCoins genres categories') // ✅ Added priceInRwf
        .populate('genres')
        .populate('categories');
    
      const signedMovies = await this.signContentArray(movies);

      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit),
          limit
        },
        genre: genre.name,
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error fetching movies by genre:', error);
      next(error);
    }
  };

  /**
   * Get movies by category (UPDATED: Returns signed URLs)
   * GET /api/v1/content/movies/category/:categoryId
   */
  getMoviesByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        return next(new AppError('Category not found', 404));
      }
      
      const skip = (page - 1) * limit;
      const totalMovies = await Content.countDocuments({ 
        contentType: 'Movie', 
        isPublished: true,
        categories: { $in: [categoryId] }
      });
      
      const movies = await Content.find({ 
        contentType: 'Movie',
        isPublished: true,
        categories: { $in: [categoryId] }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInRwf priceInCoins genres categories') // ✅ Added priceInRwf
        .populate('genres')
        .populate('categories');
    
      const signedMovies = await this.signContentArray(movies);

      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit),
          limit
        },
        category: category.name,
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error fetching movies by category:', error);
      next(error);
    }
  };

  /**
   * Get purchased movies (UPDATED: Returns signed URLs)
   * GET /api/v1/content/purchased/movies
   */
  getPurchasedMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return next(new AppError('Authentication required', 401));
      }

      const User = require('../data/models/user.model').User;
      const user = await User.findById(authReq.user._id).select('purchasedContent');
      
      if (!user || !user.purchasedContent) {
        return res.status(200).json({
          status: 'success',
          results: 0,
          data: { movies: [] }
        });
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      const totalMovies = await Content.countDocuments({ 
        _id: { $in: user.purchasedContent.map((pc: any) => pc.contentId) },
        contentType: 'Movie'
      });
      
      const movies = await Content.find({ 
        _id: { $in: user.purchasedContent.map((pc: any) => pc.contentId) },
        contentType: 'Movie'
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear genres categories')
        .populate('genres')
        .populate('categories');
      
      const signedMovies = await this.signContentArray(movies);

      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit),
          limit
        },
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error fetching purchased movies:', error);
      next(error);
    }
  };

  /**
   * Get all series (UPDATED: Returns signed URLs)
   * GET /api/v1/content/series
   */
  getAllSeries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const series = await Content.find({ 
        contentType: 'Series',
        isPublished: true 
      })
        .select('title description posterImageUrl releaseYear totalSeriesPriceInRwf discountedSeriesPriceInRwf seriesDiscountPercent seasons')
        .populate('genres', 'name')
        .populate('categories', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Content.countDocuments({ 
        contentType: 'Series',
        isPublished: true 
      });

      const signedSeries = await this.signContentArray(series);

      const seriesWithCounts = signedSeries.map((s: any) => {
        const totalEpisodes = s.seasons?.reduce(
          (total: number, season: any) => total + season.episodes.length,
          0
        ) || 0;

        const totalSeasons = s.seasons?.length || 0;

        const seasonsInfo = s.seasons?.map((season: any) => ({
          seasonNumber: season.seasonNumber,
          seasonTitle: season.seasonTitle,
          episodeCount: season.episodes.length
        })) || [];

        return {
          _id: s._id,
          title: s.title,
          description: s.description,
          posterImageUrl: s.posterImageUrl,
          releaseYear: s.releaseYear,
          totalSeriesPriceInRwf: s.totalSeriesPriceInRwf,
          discountedSeriesPriceInRwf: s.discountedSeriesPriceInRwf,
          seriesDiscountPercent: s.seriesDiscountPercent,
          genres: s.genres,
          categories: s.categories,
          totalSeasons,
          totalEpisodes,
          seasons: seasonsInfo
        };
      });

      res.status(200).json({
        status: 'success',
        results: series.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: { series: seriesWithCounts }
      });
    } catch (error) {
      console.error('Error fetching series:', error);
      next(error);
    }
  };

  /**
   * Get series details (UPDATED: Returns signed URLs)
   * GET /api/v1/content/series/:contentId
   */
  getSeriesDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params;

      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      })
        .populate('genres')
        .populate('categories');

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      const authReq = req as AuthRequest;
      const userAccess = {
        isPurchased: false,
        unlockedEpisodes: [] as string[]
      };

      if (authReq.user) {
        // Admin has full access
        if (authReq.user.role === 'admin') {
          userAccess.isPurchased = true;
          // Unlock all episodes for admin
          if (series.seasons) {
            for (const season of series.seasons) {
              for (const episode of season.episodes) {
                if (episode._id) {
                  userAccess.unlockedEpisodes.push(episode._id.toString());
                }
              }
            }
          }
        } else {
          const User = require('../data/models/user.model').User;
          const user = await User.findById(authReq.user._id);
          
          if (user) {
            const seriesPurchase = user.purchasedContent?.find(
              (pc: any) => pc.contentId.toString() === contentId
            );

            if (seriesPurchase) {
              userAccess.isPurchased = true;
              userAccess.unlockedEpisodes = seriesPurchase.episodeIdsAtPurchase || [];
            }

            const purchasedEpisodeIds = user.purchasedEpisodes
              ?.filter((pe: any) => pe.contentId.toString() === contentId)
              .map((pe: any) => pe.episodeId.toString()) || [];

            userAccess.unlockedEpisodes = [
              ...userAccess.unlockedEpisodes,
              ...purchasedEpisodeIds
            ];
          }
        }
      }

      const seriesData = series.toObject();
      const signedSeries = await this.signContentUrls(seriesData);

      if (signedSeries.seasons && Array.isArray(signedSeries.seasons)) {
        signedSeries.seasons = signedSeries.seasons.map((season: any) => ({
          ...season,
          episodes: season.episodes.map((ep: any) => ({
            ...ep,
            isUnlocked: userAccess.isPurchased || 
                       ep.isFree || 
                       userAccess.unlockedEpisodes.includes(ep._id.toString())
          }))
        }));
      }

      res.status(200).json({
        status: 'success',
        data: {
          series: {
            ...signedSeries,
            userAccess
          }
        }
      });
    } catch (error) {
      console.error('Error fetching series details:', error);
      next(error);
    }
  };

  /**
   * Get season details (UPDATED: Returns signed URLs)
   * GET /api/v1/content/series/:contentId/seasons/:seasonNumber
   */
  getSeasonDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonNumber } = req.params;

      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      const season = series.seasons?.find(
        (s: any) => s.seasonNumber === parseInt(seasonNumber)
      );

      if (!season) {
        return next(new AppError(`Season ${seasonNumber} not found`, 404));
      }

      const authReq = req as AuthRequest;
      const userAccess = {
        isPurchased: false,
        unlockedEpisodes: [] as string[]
      };

      if (authReq.user) {
        // Admin has full access
        if (authReq.user.role === 'admin') {
          userAccess.isPurchased = true;
          userAccess.unlockedEpisodes = season.episodes.map((ep: any) => ep._id.toString());
        } else {
          const User = require('../data/models/user.model').User;
          const user = await User.findById(authReq.user._id);
          
          if (user) {
            const seriesPurchase = user.purchasedContent?.find(
              (pc: any) => pc.contentId.toString() === contentId
            );

            if (seriesPurchase) {
              userAccess.isPurchased = true;
              userAccess.unlockedEpisodes = seriesPurchase.episodeIdsAtPurchase || [];
            }

            const purchasedEpisodeIds = user.purchasedEpisodes
              ?.filter((pe: any) => pe.contentId.toString() === contentId)
              .map((pe: any) => pe.episodeId.toString()) || [];

            userAccess.unlockedEpisodes = [
              ...userAccess.unlockedEpisodes,
              ...purchasedEpisodeIds
            ];
          }
        }
      }

      const seasonData = JSON.parse(JSON.stringify(season));
      
      // Sign episode thumbnails
      for (const ep of seasonData.episodes) {
        if (ep.thumbnailUrl) {
          ep.thumbnailUrl = await this.s3Service.getSignedUrl(ep.thumbnailUrl, 86400);
        }
        ep.isUnlocked = userAccess.isPurchased || 
                       ep.isFree || 
                       userAccess.unlockedEpisodes.includes(ep._id.toString());
      }

      // Sign series poster
      let signedPosterUrl = series.posterImageUrl;
      if (signedPosterUrl) {
        signedPosterUrl = await this.s3Service.getSignedUrl(signedPosterUrl, 86400);
      }

      res.status(200).json({
        status: 'success',
        data: {
          series: {
            _id: series._id,
            title: series.title,
            posterImageUrl: signedPosterUrl
          },
          season: {
            ...seasonData,
            userAccess
          }
        }
      });
    } catch (error) {
      console.error('Error fetching season details:', error);
      next(error);
    }
  };

  /**
   * Get episode details (UPDATED: Returns signed URLs)
   * GET /api/v1/content/series/:contentId/episodes/:episodeId
   */
  getEpisodeDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, episodeId } = req.params;

      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      let episode: any = null;
      let seasonNumber: number = 0;

      for (const season of series.seasons || []) {
        const foundEpisode = season.episodes.find(
          (ep: any) => ep._id.toString() === episodeId
        );
        if (foundEpisode) {
          episode = foundEpisode;
          seasonNumber = season.seasonNumber;
          break;
        }
      }

      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }

      let isUnlocked = episode.isFree;

      const authReq = req as AuthRequest;
      if (authReq.user) {
        // Admin always has access
        if (authReq.user.role === 'admin') {
          isUnlocked = true;
        } else if (!isUnlocked) {
          const User = require('../data/models/user.model').User;
          const user = await User.findById(authReq.user._id);
          
          if (user) {
            const hasFullSeries = user.purchasedContent?.some(
              (pc: any) => pc.contentId.toString() === contentId
            );

            const hasPurchasedEpisode = user.purchasedEpisodes?.some(
              (pe: any) => pe.episodeId.toString() === episodeId
            );

            isUnlocked = hasFullSeries || hasPurchasedEpisode;
          }
        }
      }

      const episodeData = JSON.parse(JSON.stringify(episode));

      // Sign episode thumbnail
      if (episodeData.thumbnailUrl) {
        episodeData.thumbnailUrl = await this.s3Service.getSignedUrl(episodeData.thumbnailUrl, 86400);
      }

      // Sign series poster
      let signedPosterUrl = series.posterImageUrl;
      if (signedPosterUrl) {
        signedPosterUrl = await this.s3Service.getSignedUrl(signedPosterUrl, 86400);
      }

      res.status(200).json({
        status: 'success',
        data: {
          series: {
            _id: series._id,
            title: series.title,
            posterImageUrl: signedPosterUrl
          },
          seasonNumber,
          episode: {
            ...episodeData,
            isUnlocked
          }
        }
      });
    } catch (error) {
      console.error('Error fetching episode details:', error);
      next(error);
    }
  };

  /**
   * Check user's access to specific content (movie or series)
   * GET /api/v1/content/:contentId/access
   */
  checkUserAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params;

      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return res.status(200).json({
          status: 'success',
          data: {
            hasAccess: false,
            accessType: 'none',
            message: 'Please login to check access'
          }
        });
      }

      console.log(`Checking access for user ${authReq.user._id} to content ${contentId}`);

      const User = require('../../data/models/user.model').User;
      const user = await User.findById(authReq.user._id);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      const content = await Content.findById(contentId);
      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      // Check full content purchase
      const hasFullAccess = user.purchasedContent?.some(
        (pc: any) => pc.contentId.toString() === contentId
      );

      if (content.contentType === 'Movie') {
        res.status(200).json({
          status: 'success',
          data: {
            hasAccess: hasFullAccess,
            accessType: hasFullAccess ? 'full' : 'none',
            contentType: 'Movie'
          }
        });
      } else {
        // For series, check episode-level access
        const purchasedEpisodeIds = user.purchasedEpisodes
          ?.filter((pe: any) => pe.contentId.toString() === contentId)
          .map((pe: any) => pe.episodeId.toString()) || [];

        const totalEpisodes = content.seasons?.reduce(
          (total: number, s: any) => total + s.episodes.length,
          0
        ) || 0;

        const freeEpisodes = content.seasons?.reduce(
          (total: number, s: any) => {
            return total + s.episodes.filter((ep: any) => ep.isFree).length;
          },
          0
        ) || 0;

        console.log(`Series access - Full: ${hasFullAccess}, Episodes: ${purchasedEpisodeIds.length}, Free: ${freeEpisodes}`);

        res.status(200).json({
          status: 'success',
          data: {
            hasAccess: hasFullAccess || purchasedEpisodeIds.length > 0 || freeEpisodes > 0,
            accessType: hasFullAccess ? 'full' : (purchasedEpisodeIds.length > 0 ? 'partial' : 'free'),
            contentType: 'Series',
            unlockedEpisodes: hasFullAccess ? totalEpisodes : purchasedEpisodeIds.length + freeEpisodes,
            totalEpisodes,
            freeEpisodes,
            purchasedEpisodeIds: hasFullAccess ? [] : purchasedEpisodeIds,
            totalSeasons: content.seasons?.length || 0
          }
        });
      }
    } catch (error) {
      console.error('Error checking user access:', error);
      next(error);
    }
  };

  /**
   * Get video URL for watching movie (UPDATED: Returns signed URLs)
   * GET /api/v1/content/:contentId/watch
   */
  getWatchContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = (req as any).content; // Set by middleware

      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      if (content.contentType !== 'Movie') {
        return next(new AppError('Use episode watch endpoint for series', 400));
      }

      // Sign all URLs before returning
      const contentObj = content.toObject();
      const signedContent = await this.signContentUrls(contentObj);

      res.status(200).json({
        status: 'success',
        data: {
          contentId: signedContent._id,
          title: signedContent.title,
          description: signedContent.description,
          contentType: 'Movie',
          videoUrl: signedContent.movieFileUrl,
          subtitles: signedContent.subtitles,
          duration: signedContent.duration,
          posterImageUrl: signedContent.posterImageUrl
        }
      });
    } catch (error) {
      console.error('Error getting watch content:', error);
      next(error);
    }
  };

  /**
   * Get episode video URL for watching (UPDATED: Returns signed URLs)
   * GET /api/v1/content/series/:contentId/episodes/:episodeId/watch
   */
  getWatchEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const episode = (req as any).episode; // Set by middleware
      const series = (req as any).series; // Set by middleware
      const seasonNumber = (req as any).seasonNumber; // Set by middleware

      if (!episode || !series) {
        return next(new AppError('Episode not found', 404));
      }

      // Sign episode URLs
      const episodeObj = JSON.parse(JSON.stringify(episode));
      
      if (episodeObj.videoUrl) {
        episodeObj.videoUrl = await this.s3Service.getSignedUrl(episodeObj.videoUrl, 7200);
      }
      
      if (episodeObj.thumbnailUrl) {
        episodeObj.thumbnailUrl = await this.s3Service.getSignedUrl(episodeObj.thumbnailUrl, 86400);
      }
      
      if (episodeObj.subtitles) {
        episodeObj.subtitles = await this.s3Service.signSubtitles(episodeObj.subtitles, 86400);
      }

      // Sign series poster
      let signedPosterUrl = series.posterImageUrl;
      if (signedPosterUrl) {
        signedPosterUrl = await this.s3Service.getSignedUrl(signedPosterUrl, 86400);
      }

      res.status(200).json({
        status: 'success',
        data: {
          seriesId: series._id,
          seriesTitle: series.title,
          posterImageUrl: signedPosterUrl,
          seasonNumber,
          episode: episodeObj
        }
      });
    } catch (error) {
      console.error('Error getting watch episode:', error);
      next(error);
    }
  };

  /**
   * Add new season to existing series
   * POST /api/v1/content/:contentId/seasons
   */
  addSeason = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params;
      const { seasonNumber, seasonTitle } = req.body;

      console.log(`Adding season ${seasonNumber} to series: ${contentId}`);

      // Find series
      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Check if season number already exists
      const existingSeason = series.seasons?.find(
        (s: any) => s.seasonNumber === parseInt(seasonNumber)
      );

      if (existingSeason) {
        return next(
          new AppError(`Season ${seasonNumber} already exists`, 400)
        );
      }

      // Add new season
      const newSeason = {
        seasonNumber: parseInt(seasonNumber),
        seasonTitle: seasonTitle || `Season ${seasonNumber}`,
        episodes: [],
      };

      if (!series.seasons) {
        series.seasons = [];
      }

      series.seasons.push(newSeason as any);

      // Save series
      await series.save();

      const addedSeason = series.seasons[series.seasons.length - 1];

      console.log(`✅ Season ${seasonNumber} added successfully`);

      res.status(201).json({
        status: 'success',
        message: 'Season added successfully',
        data: {
          season: addedSeason,
          totalSeasons: series.seasons.length,
        },
      });
    } catch (error) {
      console.error('Error adding season:', error);
      next(error);
    }
  };

  /**
   * Get unlocked content for authenticated user
   * GET /api/v1/content/unlocked
   */
  getUnlockedContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return next(new AppError('Authentication required', 401));
      }

      const User = require('../data/models/user.model').User;
      const user = await User.findById(authReq.user._id).select('purchasedContent purchasedEpisodes');
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Get all purchased content IDs
      const purchasedContentIds = user.purchasedContent?.map((pc: any) => pc.contentId) || [];

      // Fetch all unlocked content
      const unlockedContent = await Content.find({
        _id: { $in: purchasedContentIds }
      })
        .select('title description posterImageUrl contentType releaseYear genres categories')
        .populate('genres')
        .populate('categories')
        .sort({ createdAt: -1 });

      // Sign all URLs using existing helper
      const signedContent = await this.signContentArray(unlockedContent);

      res.status(200).json({
        status: 'success',
        results: unlockedContent.length,
        data: {
          content: signedContent,
          purchasedEpisodes: user.purchasedEpisodes || []
        }
      });
    } catch (error) {
      console.error('Error fetching unlocked content:', error);
      next(error);
    }
  };

  /**
   * Add episode to existing season
   * POST /api/v1/content/:contentId/seasons/:seasonId/episodes
   */
  addEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};

      // ✅ DETAILED DEBUG LOGGING
      console.log('\n' + '='.repeat(60));
      console.log('⭐ ADD EPISODE - DETAILED DEBUG');
      console.log('='.repeat(60));
      console.log('Content ID:', contentId);
      console.log('Season ID:', seasonId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Files object keys:', Object.keys(files));
      console.log('Files object:', JSON.stringify(
        Object.keys(files).reduce((acc, key) => {
          acc[key] = files[key]?.map(f => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size
          }));
          return acc;
        }, {} as any),
        null,
        2
      ));
      console.log('='.repeat(60) + '\n');

      // Validate required fields
      if (!req.body.episodeNumber || !req.body.title) {
        return next(new AppError('Episode number and title are required', 400));
      }

      // ✅ IMPROVED: Check with detailed error
      if (!files.videoFile || !files.videoFile[0]) {
        console.error('❌ VIDEO FILE NOT FOUND!');
        console.error('Available file fields:', Object.keys(files));
        
        // Return detailed error for debugging
        return res.status(400).json({
          status: 'fail',
          message: 'Episode video file is required',
          debug: {
            receivedFields: Object.keys(files),
            expectedField: 'videoFile',
            bodyFields: Object.keys(req.body),
            hint: 'Make sure the form field name is exactly "videoFile" (case-sensitive)'
          }
        });
      }

      console.log('✅ Video file found:', files.videoFile[0].originalname);

      // Find series
      const series = await Content.findOne({
        _id: contentId,
        contentType: 'Series'
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find season
      const season = series.seasons?.find((s: any) => s._id.toString() === seasonId);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      // Check if episode number already exists
      const existingEpisode = season.episodes?.find(
        (e: any) => e.episodeNumber === parseInt(req.body.episodeNumber)
      );

      if (existingEpisode) {
        return next(
          new AppError(`Episode ${req.body.episodeNumber} already exists in this season`, 400)
        );
      }

      console.log('🔄 Uploading video to S3...');

      // Upload video file using existing S3 service
      const videoUrl = await this.s3Service.uploadFile(files.videoFile[0], 'videos');

      console.log('✅ Video uploaded:', videoUrl);

      // Upload thumbnail if provided
      let thumbnailUrl;
      if (files.thumbnailImage?.[0]) {
        console.log('🔄 Uploading thumbnail...');
        thumbnailUrl = await this.s3Service.uploadFile(files.thumbnailImage[0], 'thumbnails');
        console.log('✅ Thumbnail uploaded:', thumbnailUrl);
      }

      // Upload subtitles if provided
      const subtitles: { en?: string; fr?: string; kin?: string } = {};
      if (files.subtitleEn?.[0]) {
        console.log('🔄 Uploading EN subtitle...');
        subtitles.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
      }
      if (files.subtitleFr?.[0]) {
        console.log('🔄 Uploading FR subtitle...');
        subtitles.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
      }
      if (files.subtitleKin?.[0]) {
        console.log('🔄 Uploading KIN subtitle...');
        subtitles.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
      }

      // Create new episode object
      const newEpisode: any = {
        episodeNumber: parseInt(req.body.episodeNumber),
        title: req.body.title,
        description: req.body.description || '',
        videoUrl,
        duration: parseInt(req.body.duration) || 0,
        isFree: req.body.isFree === 'true',
      };

      // Add optional fields
      if (thumbnailUrl) newEpisode.thumbnailUrl = thumbnailUrl;
      if (Object.keys(subtitles).length > 0) newEpisode.subtitles = subtitles;
      if (req.body.priceInRwf) newEpisode.priceInRwf = parseInt(req.body.priceInRwf);
      if (req.body.priceInCoins) newEpisode.priceInCoins = parseInt(req.body.priceInCoins);
      if (req.body.trailerYoutubeLink) newEpisode.trailerYoutubeLink = req.body.trailerYoutubeLink;  // ✅ ADD THIS LINE
      if (req.body.isPublished !== undefined) newEpisode.isPublished = req.body.isPublished === 'true';  // ✅ ADD THIS LINE

      // Add episode to season
      season.episodes.push(newEpisode);

      // Save series
      await series.save();

      const addedEpisode = season.episodes[season.episodes.length - 1];

      console.log('✅ Episode added successfully\n');

      // ✅ Sign episode URLs before returning
      const episodeObj = JSON.parse(JSON.stringify(addedEpisode));
      
      if (episodeObj.videoUrl) {
        episodeObj.videoUrl = await this.s3Service.getSignedUrl(episodeObj.videoUrl, 7200); // 2 hours
      }
      
      if (episodeObj.thumbnailUrl) {
        episodeObj.thumbnailUrl = await this.s3Service.getSignedUrl(episodeObj.thumbnailUrl, 86400); // 24 hours
      }
      
      if (episodeObj.subtitles) {
        episodeObj.subtitles = await this.s3Service.signSubtitles(episodeObj.subtitles, 86400); // 24 hours
      }

      res.status(201).json({
        status: 'success',
        message: 'Episode added successfully',
        data: {
          episode: episodeObj  // ✅ Return signed episode
        }
      });
    } catch (error) {
      console.error('❌ Error adding episode:', error);
      next(error);
    }
  };

  /**
   * Update episode in a season
   * PATCH /api/v1/content/:contentId/seasons/:seasonId/episodes/:episodeId
   */
  updateEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId, episodeId } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};

      console.log('\n' + '='.repeat(60));
      console.log('🔄 UPDATE EPISODE - DEBUG');
      console.log('='.repeat(60));
      console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
      console.log('📁 Files:', Object.keys(files));
      console.log('='.repeat(60) + '\n');

      // Find series
      const series = await Content.findOne({
        _id: contentId,
        contentType: 'Series'
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find season
      const season = series.seasons?.find((s: any) => s._id.toString() === seasonId);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      // Find episode
      const episode = season.episodes?.find((e: any) => e._id.toString() === episodeId);
      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }

      console.log('📝 BEFORE UPDATE:');
      console.log('  - trailerYoutubeLink:', episode.trailerYoutubeLink);
      console.log('  - isPublished:', episode.isPublished);

      // Update basic fields
      if (req.body.title !== undefined) episode.title = req.body.title;
      if (req.body.description !== undefined) episode.description = req.body.description;
      if (req.body.duration !== undefined) episode.duration = parseInt(req.body.duration);
      if (req.body.isFree !== undefined) episode.isFree = req.body.isFree === 'true';
      if (req.body.priceInRwf !== undefined) episode.priceInRwf = parseInt(req.body.priceInRwf);
      if (req.body.priceInCoins !== undefined) episode.priceInCoins = parseInt(req.body.priceInCoins);
      if (req.body.trailerYoutubeLink !== undefined) {
        episode.trailerYoutubeLink = req.body.trailerYoutubeLink;
        console.log('✅ Setting trailerYoutubeLink to:', req.body.trailerYoutubeLink);
      }
      if (req.body.isPublished !== undefined) {
        episode.isPublished = req.body.isPublished === 'true';
        console.log('✅ Setting isPublished to:', req.body.isPublished === 'true');
      }

      console.log('📝 AFTER UPDATE:');
      console.log('  - trailerYoutubeLink:', episode.trailerYoutubeLink);
      console.log('  - isPublished:', episode.isPublished);

      // Handle video file update
      if (files.videoFile && files.videoFile[0]) {
        console.log('🔄 Uploading new video...');
        const videoUrl = await this.s3Service.uploadFile(files.videoFile[0], 'videos');
        episode.videoUrl = videoUrl;
        console.log('✅ New video uploaded:', videoUrl);
      }

      // Handle thumbnail update
      if (files.thumbnailImage && files.thumbnailImage[0]) {
        console.log('🔄 Uploading new thumbnail...');
        const thumbnailUrl = await this.s3Service.uploadFile(files.thumbnailImage[0], 'thumbnails');
        episode.thumbnailUrl = thumbnailUrl;
        console.log('✅ New thumbnail uploaded:', thumbnailUrl);
      }

      // Handle subtitle updates
      if (files.subtitleEn && files.subtitleEn[0]) {
        if (!episode.subtitles) episode.subtitles = {};
        episode.subtitles.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
      }
      if (files.subtitleFr && files.subtitleFr[0]) {
        if (!episode.subtitles) episode.subtitles = {};
        episode.subtitles.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
      }
      if (files.subtitleKin && files.subtitleKin[0]) {
        if (!episode.subtitles) episode.subtitles = {};
        episode.subtitles.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
      }

      // Save series
      await series.save();

      console.log('💾 SAVED TO DATABASE');
      console.log('  - trailerYoutubeLink:', episode.trailerYoutubeLink);
      console.log('  - isPublished:', episode.isPublished);

      // Sign episode URLs before returning
      const episodeObj = JSON.parse(JSON.stringify(episode));
    
      console.log('📦 BEFORE JSON.stringify/parse:');
      console.log('  - episode.trailerYoutubeLink:', episode.trailerYoutubeLink);
      console.log('  - episode.isPublished:', episode.isPublished);
    
      console.log('📦 AFTER JSON.stringify/parse:');
      console.log('  - episodeObj.trailerYoutubeLink:', episodeObj.trailerYoutubeLink);
      console.log('  - episodeObj.isPublished:', episodeObj.isPublished);
      console.log('  - episodeObj keys:', Object.keys(episodeObj));
    
      if (episodeObj.videoUrl) {
        episodeObj.videoUrl = await this.s3Service.getSignedUrl(episodeObj.videoUrl, 7200);
      }
    
      if (episodeObj.thumbnailUrl) {
        episodeObj.thumbnailUrl = await this.s3Service.getSignedUrl(episodeObj.thumbnailUrl, 86400);
      }
    
      if (episodeObj.subtitles) {
        episodeObj.subtitles = await this.s3Service.signSubtitles(episodeObj.subtitles, 86400);
      }

      console.log('📤 FINAL RESPONSE OBJECT:');
      console.log(JSON.stringify(episodeObj, null, 2));
      console.log('='.repeat(60) + '\n');

      res.status(200).json({
        status: 'success',
        message: 'Episode updated successfully',
        data: {
          episode: episodeObj
        }
      });
    } catch (error) {
      console.error('❌ Error updating episode:', error);
      next(error);
    }
  };

  /**
   * Delete episode
   * DELETE /api/v1/content/:contentId/seasons/:seasonId/episodes/:episodeId
   */
  deleteEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId, episodeId } = req.params;

      console.log('🗑️  DELETE EPISODE - REQUEST');
      console.log(`Content: ${contentId}, Season: ${seasonId}, Episode: ${episodeId}`);

      // Find series
      const series = await Content.findOne({
        _id: contentId,
        contentType: 'Series'
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find season
      const season = series.seasons?.find((s: any) => s._id.toString() === seasonId);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      // Find episode index
      const episodeIndex = season.episodes?.findIndex(
        (e: any) => e._id.toString() === episodeId
      );

      if (episodeIndex === -1 || episodeIndex === undefined) {
        return next(new AppError('Episode not found', 404));
      }

      const episode = season.episodes[episodeIndex];

      console.log(`Deleting episode: ${episode.title}`);

      // Delete all associated files from S3
      try {
        // Delete video
        if (episode.videoUrl) {
          console.log(`Deleting video: ${episode.videoUrl}`);
          await this.s3Service.deleteFile(episode.videoUrl);
        }

        // Delete thumbnail
        if (episode.thumbnailUrl) {
          console.log(`Deleting thumbnail: ${episode.thumbnailUrl}`);
          await this.s3Service.deleteFile(episode.thumbnailUrl);
        }

        // Delete subtitles
        if (episode.subtitles) {
          if (episode.subtitles.en) {
            console.log(`Deleting EN subtitle`);
            await this.s3Service.deleteFile(episode.subtitles.en);
          }
          if (episode.subtitles.fr) {
            console.log(`Deleting FR subtitle`);
            await this.s3Service.deleteFile(episode.subtitles.fr);
          }
          if (episode.subtitles.kin) {
            console.log(`Deleting KIN subtitle`);
            await this.s3Service.deleteFile(episode.subtitles.kin);
          }
        }
      } catch (fileError) {
        console.error('Error deleting S3 files:', fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Remove episode from array
      season.episodes.splice(episodeIndex, 1);

      // Save series
      await series.save();

      console.log('✅ Episode deleted successfully');

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting episode:', error);
      next(error);
    }
  };

  /**
   * Toggle content publish status
   * PATCH /api/v1/content/:id/toggle-publish
   */
  togglePublishStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      console.log(`📢 TOGGLE PUBLISH STATUS - Content ID: ${id}`);

      const content = await Content.findById(id);

      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      // Toggle the publish status
      const previousStatus = content.isPublished;
      content.isPublished = !content.isPublished;
      
      await content.save();

      console.log(`Status changed: ${previousStatus} → ${content.isPublished}`);

      // Convert to plain object and sign URLs
      const contentObj = content.toObject();
      const signedContent = await this.signContentUrls(contentObj);

      res.status(200).json({
        status: 'success',
        message: `Content ${content.isPublished ? 'published' : 'unpublished'} successfully`,
        data: {
          content: signedContent
        }
      });
    } catch (error) {
      console.error('Error toggling publish status:', error);
      next(error);
    }
  };

  /**
   * Get all movies for admin with full details
   * GET /api/v1/content/admin/movies
   */
  getAdminMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Build query filter
      const queryObj: any = { contentType: 'Movie' };

      // Filter by publish status if provided
      if (req.query.isPublished !== undefined) {
        queryObj.isPublished = req.query.isPublished === 'true';
      }

      // Filter by genre if provided
      if (req.query.genreId) {
        queryObj.genres = req.query.genreId;
      }

      // Filter by category if provided
      if (req.query.categoryId) {
        queryObj.categories = req.query.categoryId;
      }

      // Search by title if provided
      if (req.query.search) {
        queryObj.title = { $regex: req.query.search, $options: 'i' };
      }

      const totalMovies = await Content.countDocuments(queryObj);
      
      const movies = await Content.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('genres', 'name')
        .populate('categories', 'name')
        .select('title description posterImageUrl movieFileUrl trailerYoutubeLink releaseYear duration priceInRwf priceInCoins isFree isPublished genres categories createdAt updatedAt');

      // Sign URLs for movies
      const signedMovies = await this.signContentArray(movies);

      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit),
          limit
        },
        data: { movies: signedMovies }
      });
    } catch (error) {
      console.error('Error fetching admin movies:', error);
      next(error);
    }
  };

  /**
   * Get all series for admin with full season and episode details
   * GET /api/v1/content/admin/series
   */
  getAdminSeries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Build query filter
      const queryObj: any = { contentType: 'Series' };

      // Filter by publish status if provided
      if (req.query.isPublished !== undefined) {
        queryObj.isPublished = req.query.isPublished === 'true';
      }

      // Filter by genre if provided
      if (req.query.genreId) {
        queryObj.genres = req.query.genreId;
      }

      // Filter by category if provided
      if (req.query.categoryId) {
        queryObj.categories = req.query.categoryId;
      }

      // Search by title if provided
      if (req.query.search) {
        queryObj.title = { $regex: req.query.search, $options: 'i' };
      }

      const totalSeries = await Content.countDocuments(queryObj);
      
      const series = await Content.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('genres', 'name')
        .populate('categories', 'name')
        .select('title description posterImageUrl trailerYoutubeLink releaseYear priceInRwf priceInCoins isFree isPublished totalSeriesPriceInRwf discountedSeriesPriceInRwf seriesDiscountPercent genres categories seasons createdAt updatedAt');

      // Sign URLs for series and episodes
      const signedSeries = await Promise.all(
        series.map(async (seriesItem) => {
          // ✅ Use 'any' type to allow dynamic properties
          const seriesObj: any = seriesItem.toObject();
          
          // Sign poster image
          if (seriesObj.posterImageUrl) {
            seriesObj.posterImageUrl = await this.s3Service.getSignedUrl(seriesObj.posterImageUrl, 86400);
          }

          // Process seasons and episodes
          if (seriesObj.seasons && seriesObj.seasons.length > 0) {
            seriesObj.seasons = await Promise.all(
              seriesObj.seasons.map(async (season: any) => {
                // Process episodes in this season
                if (season.episodes && season.episodes.length > 0) {
                  season.episodes = await Promise.all(
                    season.episodes.map(async (episode: any) => {
                      const episodeObj: any = {
                        _id: episode._id,
                        episodeNumber: episode.episodeNumber,
                        title: episode.title,
                        description: episode.description || '',
                        duration: episode.duration,
                        isFree: Boolean(episode.isFree),
                        isPublished: episode.isPublished !== undefined ? Boolean(episode.isPublished) : true,
                        priceInRwf: episode.priceInRwf || 0,
                        priceInCoins: episode.priceInCoins || 0,
                        releaseDate: episode.releaseDate,
                        createdAt: episode.createdAt,
                        updatedAt: episode.updatedAt,
                      };

                      // Sign episode video URL (shorter expiry for admin preview)
                      if (episode.videoUrl) {
                        episodeObj.videoUrl = await this.s3Service.getSignedUrl(episode.videoUrl, 3600);
                      }

                      // Sign episode thumbnail
                      if (episode.thumbnailUrl) {
                        episodeObj.thumbnailUrl = await this.s3Service.getSignedUrl(episode.thumbnailUrl, 86400);
                      }

                      // Include trailer link
                      if (episode.trailerYoutubeLink) {
                        episodeObj.trailerYoutubeLink = episode.trailerYoutubeLink;
                      }

                      // Sign subtitles
                      if (episode.subtitles) {
                        episodeObj.subtitles = await this.s3Service.signSubtitles(episode.subtitles, 86400);
                      }

                      return episodeObj;
                    })
                  );
                }

                return {
                  _id: season._id,
                  seasonNumber: season.seasonNumber,
                  seasonTitle: season.seasonTitle,
                  description: season.description,
                  releaseDate: season.releaseDate,
                  episodes: season.episodes || [],
                  episodeCount: season.episodes?.length || 0
                };
              })
            );

            // ✅ Add season count and total episode count (now works with 'any' type)
            seriesObj.seasonCount = seriesObj.seasons.length;
            seriesObj.totalEpisodes = seriesObj.seasons.reduce(
              (total: number, season: any) => total + (season.episodeCount || 0),
              0
            );
          } else {
            seriesObj.seasons = [];
            seriesObj.seasonCount = 0;
            seriesObj.totalEpisodes = 0;
          }

          return seriesObj;
        })
      );

      res.status(200).json({
        status: 'success',
        results: series.length,
        pagination: {
          total: totalSeries,
          page,
          pages: Math.ceil(totalSeries / limit),
          limit
        },
        data: { series: signedSeries }
      });
    } catch (error) {
      console.error('Error fetching admin series:', error);
      next(error);
    }
  };

  /**
   * Get single series with full details (admin)
   * GET /api/v1/content/admin/series/:id
   */
  getAdminSeriesById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const series = await Content.findOne({
        _id: id,
        contentType: 'Series'
      })
        .populate('genres', 'name')
        .populate('categories', 'name');

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Sign URLs using existing helper method
      const seriesObj = series.toObject();
      const signedSeries = await this.signContentUrls(seriesObj);

      res.status(200).json({
        status: 'success',
        data: { series: signedSeries }
      });
    } catch (error) {
      console.error('Error fetching admin series by ID:', error);
      next(error);
    }
  };
}

interface SeriesAdminResponse {
  _id: string;
  title: string;
  description?: string;
  posterImageUrl?: string;
  trailerYoutubeLink?: string;
  releaseYear?: number;
  priceInRwf?: number;
  priceInCoins?: number;
  isFree?: boolean;
  isPublished?: boolean;
  genres?: any[];
  categories?: any[];
  seasons?: any[];
  seasonCount: number;      // ✅ Explicitly defined
  totalEpisodes: number;    // ✅ Explicitly defined
  createdAt?: Date;
  updatedAt?: Date;
}