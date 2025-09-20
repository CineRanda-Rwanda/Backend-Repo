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
    console.log('--- [DEBUG] ENTERED createContent CONTROLLER ---');
    try {
      const files = req.files as { [fieldname:string]: Express.Multer.File[] };

      console.log('--- [DEBUG] Step 1: Validating files... ---');
      if (!files.posterImage || !files.posterImage[0]) {
        return next(new AppError('Poster image is required.', 400));
      }
      if (req.body.contentType === 'Movie' && (!files.movieFile || !files.movieFile[0])) {
        return next(new AppError('Movie file is required for content type "Movie".', 400));
      }

      console.log('--- [DEBUG] Step 2: Uploading poster to S3... ---');
      const posterImageUrl = await this.s3Service.uploadFile(files.posterImage[0], 'posters');
      console.log('--- [DEBUG] Step 3: Poster uploaded successfully. ---');
      
      let movieFileUrl: string | undefined;
      if (req.body.contentType === 'Movie') {
        console.log('--- [DEBUG] Step 4: Uploading movie file to S3... ---');
        movieFileUrl = await this.s3Service.uploadFile(files.movieFile[0], 'movies');
        console.log('--- [DEBUG] Step 5: Movie file uploaded successfully. ---');
      }

      console.log('--- [DEBUG] Step 6: Uploading subtitles (if any)... ---');
      const subtitles: { en?: string; fr?: string; kin?: string; } = {};
      if (files.subtitleEn?.[0]) {
        subtitles.en = await this.s3Service.uploadFile(files.subtitleEn[0], 'subtitles');
      }
      if (files.subtitleFr?.[0]) {
        subtitles.fr = await this.s3Service.uploadFile(files.subtitleFr[0], 'subtitles');
      }
      if (files.subtitleKin?.[0]) {
        subtitles.kin = await this.s3Service.uploadFile(files.subtitleKin[0], 'subtitles');
      }
      console.log('--- [DEBUG] Step 7: Subtitles processed. ---');

      console.log('--- [DEBUG] Step 8: Creating document in MongoDB... ---');
      const newContent = await Content.create({
        ...req.body,
        priceInRwf: Number(req.body.priceInRwf),
        priceInCoins: Number(req.body.priceInCoins),
        duration: Number(req.body.duration),
        posterImageUrl,
        movieFileUrl,
        subtitles: Object.keys(subtitles).length > 0 ? subtitles : undefined,
      });
      console.log('--- [DEBUG] Step 9: MongoDB document created. ---');

      res.status(201).json({
        status: 'success',
        message: 'Content created successfully.',
        data: {
          content: newContent,
        },
      });
      
      console.log('--- [DEBUG] REQUEST FINISHED SUCCESSFULLY ---');

    } catch (error) {
      console.error('--- [DEBUG] ERROR IN CREATE CONTENT ---', error);
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
}