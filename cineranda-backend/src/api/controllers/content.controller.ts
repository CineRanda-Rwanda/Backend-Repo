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
      // Build query
      const queryObj = { contentType: 'Movie', isPublished: true };
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Get total count for pagination
      const totalMovies = await Content.countDocuments(queryObj);
      
      // Get movies with pagination
      const movies = await Content.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInCoins genres categories')
        .populate('genres')
        .populate('categories');
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit)
        },
        data: {
          movies
        }
      });
    } catch (error) {
      console.error('Error fetching movies:', error);
      next(error);
    }
  };

  // Search movies
  searchMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return next(new AppError('Search query is required', 400));
      }
      
      console.log(`Searching for movies with query: "${query}"`);
      
      // Find movies matching the search query
      const movies = await Content.find({
        contentType: 'Movie',
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { cast: { $in: [new RegExp(query as string, 'i')] } }
        ]
      })
      .select('title description posterImageUrl releaseYear priceInCoins')
      .populate('genres')
      .populate('categories');
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        data: {
          movies
        }
      });
    } catch (error) {
      console.error('Error searching movies:', error);
      next(error);
    }
  };

  // Get movies by genre
  getMoviesByGenre = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { genreId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      console.log(`Finding movies for genre ID: ${genreId}`);
      
      // Verify genre exists
      const genre = await this.genreRepository.findById(genreId);
      if (!genre) {
        return next(new AppError('Genre not found', 404));
      }
      console.log(`Genre found: ${genre.name}`);
      
      // Find movies with this genre - use direct DB query instead of repository
      const skip = (page - 1) * limit;
      
      // Get total count for pagination
      const totalMovies = await Content.countDocuments({ 
        contentType: 'Movie', 
        isPublished: true,
        genres: { $in: [genreId] }
      });
      
      console.log(`Found ${totalMovies} movies matching genre criteria`);
      
      // Get movies with pagination
      const movies = await Content.find({ 
        contentType: 'Movie',
        isPublished: true,
        genres: { $in: [genreId] }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInCoins genres categories')
        .populate('genres')
        .populate('categories');
    
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
        data: { movies }
      });
    } catch (error) {
      console.error('Error fetching movies by genre:', error);
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
      
      console.log(`Fetching movie details for ID: ${id}`);
      
      // Use Content model directly instead of repository
      const movie = await Content.findOne({
        _id: id,
        contentType: 'Movie'
      })
      .populate('genres')
      .populate('categories');
      
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      console.log(`Found movie: ${movie.title}`);
      
      // Check if user has purchased this movie (optional auth)
      let isPurchased = false;
      let watchProgress = null;
      
      const authReq = req as AuthRequest;
      if (authReq.user) {
        // Get watch history for authenticated users
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
      
      res.status(200).json({
        status: 'success',
        data: { 
          movie,
          isPurchased,
          watchProgress
        }
      });
    } catch (error) {
      console.error('Error fetching movie details:', error);
      next(error);
    }
  };

  // Get content by type (Movie or Series)
  getContentByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentType } = req.params;
      
      // Validate content type
      if (!['Movie', 'Series'].includes(contentType)) {
        return next(new AppError('Invalid content type. Must be Movie or Series', 400));
      }
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Get content by type
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
      .select('title description posterImageUrl releaseYear priceInCoins')
      .populate('genres')
      .populate('categories');
      
      res.status(200).json({
        status: 'success',
        results: content.length,
        pagination: {
          total: totalCount,
          page,
          pages: Math.ceil(totalCount / limit)
        },
        data: {
          content
        }
      });
    } catch (error) {
      console.error(`Error fetching ${req.params.contentType}:`, error);
      next(error);
    }
  };

  // Get movies by category
  getMoviesByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Verify category exists
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        return next(new AppError('Category not found', 404));
      }
      
      // Find movies with this category
      const skip = (page - 1) * limit;
      
      // Get total count for pagination
      const totalMovies = await Content.countDocuments({ 
        contentType: 'Movie', 
        isPublished: true,
        categories: { $in: [categoryId] }
      });
      
      // Get movies with pagination
      const movies = await Content.find({ 
        contentType: 'Movie',
        isPublished: true,
        categories: { $in: [categoryId] }
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear priceInCoins genres categories')
        .populate('genres')
        .populate('categories');
    
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
        data: { movies }
      });
    } catch (error) {
      console.error('Error fetching movies by category:', error);
      next(error);
    }
  };

  // Toggle publish status of content
  togglePublishStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const content = await Content.findById(id);

      if (!content) {
        return next(new AppError('No content found with that ID', 404));
      }

      // Toggle the published status
      content.isPublished = !content.isPublished;
      await content.save();

      const status = content.isPublished ? 'published' : 'unpublished';

      res.status(200).json({
        status: 'success',
        message: `Content successfully ${status}`,
        data: {
          content: {
            _id: content._id,
            title: content.title,
            contentType: content.contentType,
            isPublished: content.isPublished
          }
        }
      });
    } catch (error) {
      console.error('Error toggling publish status:', error);
      next(error);
    }
  };

  // Get purchased movies for the authenticated user
  getPurchasedMovies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return next(new AppError('Authentication required', 401));
      }

      // Get the user with purchased content IDs
      const User = require('../../data/models/user.model').User;
      const user = await User.findById(authReq.user._id).select('purchasedContent');
      
      if (!user || !user.purchasedContent) {
        return res.status(200).json({
          status: 'success',
          results: 0,
          data: { movies: [] }
        });
      }
      
      console.log(`Found ${user.purchasedContent.length} purchased content items for user`);
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Find all purchased movies
      const totalMovies = await Content.countDocuments({ 
        _id: { $in: user.purchasedContent },
        contentType: 'Movie'
      });
      
      const movies = await Content.find({ 
        _id: { $in: user.purchasedContent },
        contentType: 'Movie'
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title description posterImageUrl releaseYear genres categories')
        .populate('genres')
        .populate('categories');
      
      console.log(`Found ${movies.length} purchased movies for user`);
      
      res.status(200).json({
        status: 'success',
        results: movies.length,
        pagination: {
          total: totalMovies,
          page,
          pages: Math.ceil(totalMovies / limit),
          limit
        },
        data: { movies }
      });
    } catch (error) {
      console.error('Error fetching purchased movies:', error);
      next(error);
    }
  };

  /**
   * Get all unlocked content for the authenticated user
   * Fetches from Purchase collection to find what user has bought
   */
  getUnlockedContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return next(new AppError('Authentication required', 401));
      }

      console.log(`Fetching unlocked content for user: ${authReq.user._id}`);

      // Import Purchase model
      const Purchase = require('../../data/models/purchase.model').Purchase;

      // Find all completed purchases for this user
      const purchases = await Purchase.find({
        userId: authReq.user._id,
        status: 'completed',
        purchaseType: 'content'
      }).select('contentId');

      console.log(`Found ${purchases.length} purchases for user`);

      // Extract content IDs
      const purchasedContentIds = purchases
        .filter((p: any) => p.contentId)
        .map((p: any) => p.contentId);

      console.log(`Purchased content IDs:`, purchasedContentIds);

      if (purchasedContentIds.length === 0) {
        return res.status(200).json({
          status: 'success',
          results: { movies: 0, series: 0 },
          data: { movies: [], series: [] }
        });
      }

      // Get purchased movies
      const unlockedMovies = await Content.find({
        _id: { $in: purchasedContentIds },
        contentType: 'Movie'
      })
        .select('title description posterImageUrl releaseYear duration priceInRwf priceInCoins')
        .populate('genres')
        .populate('categories')
        .lean();

      console.log(`Found ${unlockedMovies.length} unlocked movies`);

      // Get purchased series
      const unlockedSeries = await Content.find({
        _id: { $in: purchasedContentIds },
        contentType: 'Series'
      })
        .populate('genres')
        .populate('categories')
        .lean();

      console.log(`Found ${unlockedSeries.length} unlocked series`);

      // Mark all series as fully purchased (since user bought the whole series)
      const markedSeries = unlockedSeries.map((series: any) => ({
        ...series,
        isPurchased: true,
        hasUnlockedEpisodes: true
      }));

      res.status(200).json({
        status: 'success',
        results: {
          movies: unlockedMovies.length,
          series: markedSeries.length
        },
        data: {
          movies: unlockedMovies,
          series: markedSeries
        }
      });

    } catch (error) {
      console.error('Error fetching unlocked content:', error);
      next(error);
    }
  };

  /**
   * Get single series with full details and user access info
   * GET /api/v1/content/series/:contentId
   */
  getSeriesDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId } = req.params;

      console.log(`Fetching series details for ID: ${contentId}`);

      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      })
        .populate('genres')
        .populate('categories');

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      console.log(`Found series: ${series.title}`);

      // If user is authenticated, check their access
      let userAccess = {
        isPurchased: false,
        unlockedEpisodes: [] as string[]
      };

      const authReq = req as AuthRequest;
      if (authReq.user) {
        const User = require('../../data/models/user.model').User;
        const user = await User.findById(authReq.user._id);
        
        if (user) {
          // Check if full series purchased
          const hasFullSeries = user.purchasedContent?.some(
            (pc: any) => pc.contentId.toString() === contentId
          );

          // Get purchased episode IDs for this series
          const purchasedEpisodeIds = user.purchasedEpisodes
            ?.filter((pe: any) => pe.contentId.toString() === contentId)
            .map((pe: any) => pe.episodeId.toString()) || [];

          userAccess = {
            isPurchased: hasFullSeries,
            unlockedEpisodes: hasFullSeries ? ['all'] : purchasedEpisodeIds
          };

          console.log(`User access - Full series: ${hasFullSeries}, Episodes: ${purchasedEpisodeIds.length}`);
        }
      }

      // Add unlock status to episodes
      const seriesData = series.toObject();
      if (seriesData.seasons && Array.isArray(seriesData.seasons)) {
        seriesData.seasons = seriesData.seasons.map((season: any) => ({
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
            ...seriesData,
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
   * Get single season with episodes and unlock status
   * GET /api/v1/content/series/:contentId/seasons/:seasonNumber
   */
  getSeasonDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonNumber } = req.params;

      console.log(`Fetching season ${seasonNumber} for series: ${contentId}`);

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

      // Check user access
      let userAccess = {
        isPurchased: false,
        unlockedEpisodes: [] as string[]
      };

      const authReq = req as AuthRequest;
      if (authReq.user) {
        const User = require('../../data/models/user.model').User;
        const user = await User.findById(authReq.user._id);
        
        if (user) {
          const hasFullSeries = user.purchasedContent?.some(
            (pc: any) => pc.contentId.toString() === contentId
          );

          const purchasedEpisodeIds = user.purchasedEpisodes
            ?.filter((pe: any) => pe.contentId.toString() === contentId)
            .map((pe: any) => pe.episodeId.toString()) || [];

          userAccess = {
            isPurchased: hasFullSeries,
            unlockedEpisodes: hasFullSeries ? ['all'] : purchasedEpisodeIds
          };
        }
      }

      // Convert season to plain object and add unlock status
      const seasonData = JSON.parse(JSON.stringify(season));
      seasonData.episodes = seasonData.episodes.map((ep: any) => ({
        ...ep,
        isUnlocked: userAccess.isPurchased || 
                   ep.isFree || 
                   userAccess.unlockedEpisodes.includes(ep._id.toString())
      }));

      res.status(200).json({
        status: 'success',
        data: {
          series: {
            _id: series._id,
            title: series.title,
            posterImageUrl: series.posterImageUrl
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
   * Get single episode details with unlock status
   * GET /api/v1/content/series/:contentId/episodes/:episodeId
   */
  getEpisodeDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, episodeId } = req.params;

      console.log(`Fetching episode ${episodeId} for series: ${contentId}`);

      const series = await Content.findOne({ 
        _id: contentId, 
        contentType: 'Series' 
      });

      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find episode across all seasons
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

      // Check user access
      let isUnlocked = episode.isFree;

      const authReq = req as AuthRequest;
      if (authReq.user && !isUnlocked) {
        const User = require('../../data/models/user.model').User;
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

      // Convert episode to plain object
      const episodeData = JSON.parse(JSON.stringify(episode));

      res.status(200).json({
        status: 'success',
        data: {
          series: {
            _id: series._id,
            title: series.title,
            posterImageUrl: series.posterImageUrl
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
   * Get video URL for watching movie (protected - requires purchase)
   * GET /api/v1/content/:contentId/watch
   */
  getWatchContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = (req as any).content; // Set by middleware

      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      if (content.contentType === 'Movie') {
        res.status(200).json({
          status: 'success',
          data: {
            contentId: content._id,
            title: content.title,
            description: content.description,
            contentType: 'Movie',
            videoUrl: content.movieFileUrl,
            subtitles: content.subtitles,
            duration: content.duration,
            posterImageUrl: content.posterImageUrl
          }
        });
      } else {
        return next(new AppError('Use episode watch endpoint for series', 400));
      }
    } catch (error) {
      console.error('Error getting watch content:', error);
      next(error);
    }
  };

  /**
   * Get episode video URL for watching (protected - requires purchase)
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

      res.status(200).json({
        status: 'success',
        data: {
          seriesId: series._id,
          seriesTitle: series.title,
          seasonNumber,
          episode: {
            _id: episode._id,
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            description: episode.description,
            videoUrl: episode.videoUrl,
            subtitles: episode.subtitles,
            duration: episode.duration,
            thumbnailUrl: episode.thumbnailUrl,
            isFree: episode.isFree
          }
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
}