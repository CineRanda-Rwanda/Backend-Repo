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
}