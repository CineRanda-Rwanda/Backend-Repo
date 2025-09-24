import { Request, Response, NextFunction } from 'express';
import { S3Service } from '../../core/services/s3.service';
import { Content } from '../../data/models/movie.model';
import AppError from '../../utils/AppError';

export class ContentController {
  private s3Service: S3Service;

  constructor() {
    this.s3Service = new S3Service();
  }

  createContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } || {};
      
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
      
      // THIS IS THE KEY CHANGE: Only require movie file for 'Movie' content type
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
      } else {
        // Series specific - handle seasons
        try {
          if (req.body.seasons) {
            const seasons = typeof req.body.seasons === 'string'
              ? JSON.parse(req.body.seasons)
              : req.body.seasons;
              
            if (Array.isArray(seasons)) {
              content.seasons = seasons;
            } else {
              content.seasons = [];
            }
          } else {
            content.seasons = [];
          }
        } catch (e) {
          content.seasons = [];
        }
      }
      
      // Save content
      const newContent = await Content.create(content);
      
      res.status(201).json({
        status: 'success',
        data: {
          content: newContent,
        },
      });
    } catch (error) {
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
      const { contentId, seasonId } = req.params;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // 1. Find the series content
      const series = await Content.findById(contentId);
      if (!series) {
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
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // 1. Find the series content
      const series = await Content.findById(contentId);
      if (!series) {
        return next(new AppError('No content found with that ID', 404));
      }
      if (series.contentType !== 'Series') {
        return next(new AppError('Content must be a Series to update episodes', 400));
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

      // 4. Find the episode
      const episodeIndex = series.seasons[seasonIndex].episodes.findIndex(
        (episode: any) => episode._id.toString() === episodeId
      );
      if (episodeIndex === -1) {
        return next(new AppError('No episode found with that ID', 404));
      }

      // 5. Get the current episode
      const currentEpisode = series.seasons[seasonIndex].episodes[episodeIndex];
      
      // 6. Prepare updates object from request body
      const updates: any = { ...req.body };
      
      // Convert numeric fields
      if (updates.episodeNumber) updates.episodeNumber = parseInt(updates.episodeNumber, 10);
      if (updates.duration) updates.duration = parseInt(updates.duration, 10);
      if (updates.priceInRwf) updates.priceInRwf = parseInt(updates.priceInRwf, 10);
      if (updates.priceInCoins) updates.priceInCoins = parseInt(updates.priceInCoins, 10);
      if (updates.isFree !== undefined) updates.isFree = updates.isFree === 'true';
      
      // 7. Handle video replacement if provided
      if (files.episodeVideo?.[0]) {
        // Delete old video if it exists
        if (currentEpisode.videoUrl) {
          await this.s3Service.deleteFile(currentEpisode.videoUrl);
        }
        // Upload new video
        updates.videoUrl = await this.s3Service.uploadFile(
          files.episodeVideo[0],
          'episodes'
        );
      }
      
      // 8. Handle subtitle replacements if provided
      const subtitleUpdates: { en?: string; fr?: string; kin?: string } = { ...currentEpisode.subtitles };
      
      if (files.subtitleEn?.[0]) {
        if (subtitleUpdates.en) {
          await this.s3Service.deleteFile(subtitleUpdates.en);
        }
        subtitleUpdates.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
      }
      
      if (files.subtitleFr?.[0]) {
        if (subtitleUpdates.fr) {
          await this.s3Service.deleteFile(subtitleUpdates.fr);
        }
        subtitleUpdates.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
      }
      
      if (files.subtitleKin?.[0]) {
        if (subtitleUpdates.kin) {
          await this.s3Service.deleteFile(subtitleUpdates.kin);
        }
        subtitleUpdates.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
      }
      
      // Only update subtitles if any were uploaded
      if (files.subtitleEn?.[0] || files.subtitleFr?.[0] || files.subtitleKin?.[0]) {
        updates.subtitles = subtitleUpdates;
      }
      
      // 9. Update the episode
      Object.assign(series.seasons[seasonIndex].episodes[episodeIndex], updates);
      await series.save();
      
      res.status(200).json({
        status: 'success',
        data: {
          episode: series.seasons[seasonIndex].episodes[episodeIndex]
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Deletes an episode from a season
   */
  deleteEpisode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentId, seasonId, episodeId } = req.params;

      // 1. Find the series content
      const series = await Content.findById(contentId);
      if (!series) {
        return next(new AppError('No content found with that ID', 404));
      }
      if (series.contentType !== 'Series') {
        return next(new AppError('Content must be a Series to delete episodes', 400));
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

      // 4. Find the episode
      const episodeIndex = series.seasons[seasonIndex].episodes.findIndex(
        (episode: any) => episode._id.toString() === episodeId
      );
      if (episodeIndex === -1) {
        return next(new AppError('No episode found with that ID', 404));
      }

      // 5. Get the episode to delete
      const episodeToDelete = series.seasons[seasonIndex].episodes[episodeIndex];

      // 6. Delete video and subtitle files from S3
      if (episodeToDelete.videoUrl) {
        await this.s3Service.deleteFile(episodeToDelete.videoUrl);
      }
      
      if (episodeToDelete.subtitles) {
        if (episodeToDelete.subtitles.en) {
          await this.s3Service.deleteFile(episodeToDelete.subtitles.en);
        }
        if (episodeToDelete.subtitles.fr) {
          await this.s3Service.deleteFile(episodeToDelete.subtitles.fr);
        }
        if (episodeToDelete.subtitles.kin) {
          await this.s3Service.deleteFile(episodeToDelete.subtitles.kin);
        }
      }

      // 7. Remove the episode from the array
      series.seasons[seasonIndex].episodes.splice(episodeIndex, 1);
      
      // 8. Save the updated series
      await series.save();

      // 8. Return 204 No Content
      res.status(204).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };
}