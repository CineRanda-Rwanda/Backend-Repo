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
      
      res.status(201).json({
        status: 'success',
        data: {
          content: newContent,
        },
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

      res.status(200).json({
        status: 'success',
        message: 'Content updated successfully.',
        data: {
          content: updatedContent,
        },
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
      // Basic Pagination
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const skip = (page - 1) * limit;

      const content = await Content.find()
        .sort({ createdAt: -1 }) // Show newest first
        .skip(skip)
        .limit(limit);
      
      const totalContent = await Content.countDocuments();

      res.status(200).json({
        status: 'success',
        results: content.length,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalContent / limit),
          totalContent,
        },
        data: {
          content,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a single piece of content by its ID.
   */
  getContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = await Content.findById(req.params.id);

      if (!content) {
        return next(new AppError('No content found with that ID', 404));
      }

      res.status(200).json({
        status: 'success',
        data: {
          content,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  addEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('⭐ ADD EPISODE - START ⭐');
      const { contentId, seasonId } = req.params;
      console.log(`Content ID: ${contentId}, Season ID: ${seasonId}`);
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};
      console.log('Files received:', Object.keys(files));
      
      // 1. Find the series content
      console.log('Finding content...');
      const series = await Content.findById(contentId);
      if (!series) {
        console.log('No content found with that ID');
        return next(new AppError('No content found with that ID', 404));
      }
      if (series.contentType !== 'Series') {
        return next(new AppError('Content must be a Series to add episodes', 400));
      }

      // 2. Make sure seasons exist
      if (!series.seasons || !Array.isArray(series.seasons)) {
        return next(new AppError('Series has no seasons array defined', 400));
      }

      // 3. Find the season
      const seasonIndex = series.seasons.findIndex(
        (season: any) => season._id.toString() === seasonId
      );
      if (seasonIndex === -1) {
        return next(new AppError('No season found with that ID', 404));
      }

      // 4. Validate required episode video
      if (!files.episodeVideo?.[0]) {
        return next(new AppError('Episode video is required', 400));
      }

      // 5. Upload episode video to S3
      const videoUrl = await this.s3Service.uploadFile(
        files.episodeVideo[0],
        'episodes'
      );

      // 6. Upload subtitle files if provided
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

      // Parse episode-specific cast if provided
      let episodeCast = [];
      if (req.body.episodeCast) {
        try {
          episodeCast = typeof req.body.episodeCast === 'string' 
            ? (req.body.episodeCast.startsWith('[') 
                ? JSON.parse(req.body.episodeCast) 
                : req.body.episodeCast.split(',').map((c: string) => c.trim()))
            : req.body.episodeCast;
        } catch (e) {
          console.log('Error parsing episode cast:', e);
          episodeCast = [req.body.episodeCast]; // Fallback to single value
        }
      }

      // 7. Create new episode object
      const newEpisode = {
        episodeNumber: parseInt(req.body.episodeNumber, 10),
        title: req.body.title,
        description: req.body.description,
        videoUrl,
        trailerYoutubeLink: req.body.trailerYoutubeLink,
        priceInRwf: req.body.priceInRwf ? parseInt(req.body.priceInRwf, 10) : undefined,
        priceInCoins: req.body.priceInCoins ? parseInt(req.body.priceInCoins, 10) : undefined,
        duration: req.body.duration ? parseInt(req.body.duration, 10) : undefined,
        isFree: req.body.isFree === 'true',
        subtitles: Object.keys(subtitles).length > 0 ? subtitles : undefined,
        // Add episode-specific cast if provided
        cast: episodeCast.length > 0 ? episodeCast : undefined
      };

      // 8. Add to season and save
      series.seasons[seasonIndex].episodes.push(newEpisode as any);
      await series.save();

      // 9. Get the newly created episode
      const createdEpisode = series.seasons[seasonIndex].episodes.slice(-1)[0];

      res.status(201).json({
        status: 'success',
        data: {
          episode: createdEpisode,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Updates an existing episode within a season
   */
  updateEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId, episodeId } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};
      
      console.log('⭐ UPDATE EPISODE - REQUEST ⭐');
      console.log(`Content ID: ${contentId}, Season ID: ${seasonId}, Episode ID: ${episodeId}`);
      console.log('Files received:', Object.keys(files));
      
      // 1. First find the current state to determine what needs updating
      const content = await Content.findById(contentId);
      if (!content || content.contentType !== 'Series') {
        return next(new AppError('Content not found or not a series', 404));
      }
      
      // 2. Find the season and episode
      const season = content.seasons?.find((s: any) => s._id.toString() === seasonId);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }
      
      const episode = season.episodes?.find((e: any) => e._id.toString() === episodeId);
      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }
      
      console.log(`Found episode: ${episode.title} (${episode._id})`);
      
      // 3. Prepare updates
      const updateData: any = {};
      const arrayUpdates: any = {};
    
      // Basic fields
      if (req.body.title) updateData[`seasons.$[season].episodes.$[episode].title`] = req.body.title;
      if (req.body.description) updateData[`seasons.$[season].episodes.$[episode].description`] = req.body.description;
      if (req.body.episodeNumber) updateData[`seasons.$[season].episodes.$[episode].episodeNumber`] = parseInt(req.body.episodeNumber, 10);
      if (req.body.duration) updateData[`seasons.$[season].episodes.$[episode].duration`] = parseInt(req.body.duration, 10);
      if (req.body.priceInRwf) updateData[`seasons.$[season].episodes.$[episode].priceInRwf`] = parseInt(req.body.priceInRwf, 10);
      if (req.body.priceInCoins) updateData[`seasons.$[season].episodes.$[episode].priceInCoins`] = parseInt(req.body.priceInCoins, 10);
      if (req.body.isFree !== undefined) updateData[`seasons.$[season].episodes.$[episode].isFree`] = req.body.isFree === 'true';
      if (req.body.trailerYoutubeLink) updateData[`seasons.$[season].episodes.$[episode].trailerYoutubeLink`] = req.body.trailerYoutubeLink;
    
      // 4. Handle files (video, subtitles)
      if (files.episodeVideo?.[0]) {
        console.log('Updating episode video');
        // Delete old video if it exists
        if (episode.videoUrl) {
          try {
            await this.s3Service.deleteFile(episode.videoUrl);
            console.log('Old video file deleted');
          } catch (err) {
            console.error('Error deleting old video:', err);
          }
        }
        
        // Upload new video
        const videoUrl = await this.s3Service.uploadFile(files.episodeVideo[0], 'episodes');
        updateData[`seasons.$[season].episodes.$[episode].videoUrl`] = videoUrl;
        console.log('New video uploaded:', videoUrl);
      }
      
      // 5. Handle subtitles
      const subtitles = { ...episode.subtitles || {} };
      let hasSubtitleChanges = false;
      
      // English subtitles
      if (files.subtitleEn?.[0]) {
        if (subtitles.en) {
          try {
            await this.s3Service.deleteFile(subtitles.en);
          } catch (err) {
            console.error('Error deleting old English subtitle:', err);
          }
        }
        subtitles.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
        hasSubtitleChanges = true;
      }
      
      // French subtitles
      if (files.subtitleFr?.[0]) {
        if (subtitles.fr) {
          try {
            await this.s3Service.deleteFile(subtitles.fr);
          } catch (err) {
            console.error('Error deleting old French subtitle:', err);
          }
        }
        subtitles.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
        hasSubtitleChanges = true;
      }
      
      // Kinyarwanda subtitles
      if (files.subtitleKin?.[0]) {
        if (subtitles.kin) {
          try {
            await this.s3Service.deleteFile(subtitles.kin);
          } catch (err) {
            console.error('Error deleting old Kinyarwanda subtitle:', err);
          }
        }
        subtitles.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
        hasSubtitleChanges = true;
      }
      
      if (hasSubtitleChanges) {
        updateData[`seasons.$[season].episodes.$[episode].subtitles`] = subtitles;
      }
    
      // 6. Apply update using MongoDB's update operators
      console.log('Applying updates:', updateData);
      
      const updatedContent = await Content.findOneAndUpdate(
        { _id: contentId },
        { $set: updateData },
        { 
          new: true, // Return updated document
          arrayFilters: [
            { 'season._id': seasonId },
            { 'episode._id': episodeId }
          ]
        }
      );
      
      if (!updatedContent) {
        return next(new AppError('Failed to update episode', 500));
      }
      
      // 7. Find the updated episode to return
      if (!updatedContent || !updatedContent.seasons) {
        return next(new AppError('Failed to retrieve updated content', 500));
      }
      
      const updatedSeason = updatedContent.seasons.find((s: any) => s._id.toString() === seasonId);
      if (!updatedSeason) {
        return next(new AppError('Failed to retrieve updated season', 500));
      }
      
      const updatedEpisode = updatedSeason.episodes.find((e: any) => e._id.toString() === episodeId);
      if (!updatedEpisode) {
        return next(new AppError('Failed to retrieve updated episode', 500));
      }
      
      console.log('✅ Episode successfully updated');
      
      res.status(200).json({
        status: 'success',
        data: {
          episode: updatedEpisode
        }
      });
    } catch (error) {
      console.error('❌ Error updating episode:', error);
      next(error);
    }
  };

  /**
   * Deletes an episode from a season
   */
  deleteEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId, episodeId } = req.params;
      
      console.log('⭐ DELETE EPISODE - REQUEST ⭐');
      console.log(`Content ID: ${contentId}, Season ID: ${seasonId}, Episode ID: ${episodeId}`);

      // 1. Find the series content to check if episode exists and get file paths
      const content = await Content.findById(contentId);
      if (!content || content.contentType !== 'Series') {
        return next(new AppError('Content not found or not a series', 404));
      }
      
      // 2. Find the season and episode
      const season = content.seasons?.find((s: any) => s._id.toString() === seasonId);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }
      
      const episode = season.episodes?.find((e: any) => e._id.toString() === episodeId);
      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }
      
      console.log(`Found episode to delete: ${episode.title} (${episode._id})`);
      
      // 3. Delete associated files from S3
      try {
        // Delete video file
        if (episode.videoUrl) {
          console.log(`Deleting video: ${episode.videoUrl}`);
          await this.s3Service.deleteFile(episode.videoUrl);
        }
        
        // Delete subtitles
        if (episode.subtitles) {
          if (episode.subtitles.en) {
            console.log(`Deleting EN subtitle: ${episode.subtitles.en}`);
            await this.s3Service.deleteFile(episode.subtitles.en);
          }
          if (episode.subtitles.fr) {
            console.log(`Deleting FR subtitle: ${episode.subtitles.fr}`);
            await this.s3Service.deleteFile(episode.subtitles.fr);
          }
          if (episode.subtitles.kin) {
            console.log(`Deleting KIN subtitle: ${episode.subtitles.kin}`);
            await this.s3Service.deleteFile(episode.subtitles.kin);
          }
        }
      } catch (fileError) {
        // Log but don't fail if file deletion fails
        console.error('Error deleting files:', fileError);
      }
      
      // 4. Delete the episode using MongoDB's $pull operator
      console.log('Removing episode from database...');
      
      const result = await Content.updateOne(
        { _id: contentId },
        { $pull: { [`seasons.$[season].episodes`]: { _id: episodeId } } },
        { 
          arrayFilters: [{ 'season._id': seasonId }]
        }
      );
      
      console.log('Update result:', result);
      
      if (result.modifiedCount === 0) {
        return next(new AppError('Failed to delete episode', 500));
      }
      
      console.log('✅ Episode successfully deleted');
      
      // 5. Return 204 No Content (with no body)
      return res.status(204).send();
    } catch (error) {
      console.error('❌ Error deleting episode:', error);
      next(error);
    }
  };

  // Get movies with pagination and filters
  getMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Build filters from query params
      const filters: any = { isActive: true };
      
      if (req.query.genre) {
        filters.genres = req.query.genre;
      }
      
      if (req.query.category) {
        filters.categories = req.query.category;
      }
      
      if (req.query.year) {
        filters.releaseYear = req.query.year;
      }
      
      // Support sort by different fields
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
      
      const { movies, total, pages } = await this.movieRepository.getMovies(
        page,
        limit,
        filters,
        sortBy,
        sortOrder
      );
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total,
          page,
          pages,
          limit
        },
        data: { movies }
      });
    } catch (error) {
      next(error);
    }
  };

  // Search movies
  searchMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return next(new AppError('Search query is required', 400));
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { movies, total, pages } = await this.movieRepository.searchMovies(
        q as string,
        page,
        limit
      );
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total,
          page,
          pages,
          limit
        },
        data: { movies }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get movies by genre
  getMoviesByGenre = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { genreId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verify genre exists
      const genre = await this.genreRepository.findById(genreId);
      if (!genre) {
        return next(new AppError('Genre not found', 404));
      }
      
      const { movies, total, pages } = await this.movieRepository.getMoviesByGenre(
        genreId,
        page,
        limit
      );
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total,
          page,
          pages,
          limit
        },
        genre: genre.name,
        data: { movies }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get featured movies (for homepage)
  getFeaturedMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const movies = await this.movieRepository.getFeaturedMovies(limit);
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        data: { movies }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get movie details with watch progress for authenticated users
  getMovieDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const movie = await this.movieRepository.findById(id);
      
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      // Populate genre and category information
      await movie.populate('genres', 'name');
      await movie.populate('categories', 'name');
      
      // Get watch history for authenticated users
      let watchProgress = null;
      const user = (req as AuthRequest).user;
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = user._id;
      const history = await this.watchHistoryRepository.findOne({ 
        userId, 
        movieId: id 
      });
      
      if (history) {
        watchProgress = {
          watchedDuration: history.watchedDuration,
          completed: history.completed,
          lastWatched: history.lastWatched
        };
      }
      
      res.status(200).json({
        status: 'success',
        data: { 
          movie,
          watchProgress
        }
      });
    } catch (error) {
      next(error);
    }
  };
}