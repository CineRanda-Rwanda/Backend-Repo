import { Router } from 'express';
import { ContentController } from '../controllers/content.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();
const contentController = new ContentController();

// --- CRITICAL: Place specific routes BEFORE parameterized routes ---

// Public content routes (specific routes first)
router.get('/movies', contentController.getMovies);
router.get('/movies/search', contentController.searchMovies);
router.get('/movies/featured', contentController.getFeaturedMovies);
router.get('/movies/genre/:genreId', contentController.getMoviesByGenre);
router.get('/movies/category/:categoryId', contentController.getMoviesByCategory);

// Protected route - THIS MUST COME BEFORE /movies/:id
router.get('/unlocked', authenticate, contentController.getUnlockedContent);

// This parameterized route comes LAST among /movies/ routes
router.get('/movies/:id', contentController.getMovieDetails);

router.get('/type/:contentType', contentController.getContentByType);

// GET /api/v1/content - Get all content (Admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  contentController.getAllContent
);

// GET /api/v1/content/:id - Get a single piece of content (Admin only)
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  contentController.getContent
);

// Define the fields for multer to expect. This is crucial.
const contentUpload = upload.fields([
  { name: 'posterImage', maxCount: 1 },
  { name: 'movieFile', maxCount: 1 },
  { name: 'subtitleEn', maxCount: 1 },
  { name: 'subtitleFr', maxCount: 1 },
  { name: 'subtitleKin', maxCount: 1 },
  // Add these for episode management
  { name: 'episodeVideo', maxCount: 1 },
]);

// POST /api/v1/content - Create new content (Admin only)
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  contentUpload,
  contentController.createContent
);

// PATCH /api/v1/content/:id - Update existing content (Admin only)
router.patch(
  '/:id',
  authenticate,
  authorize(['admin']),
  contentUpload,
  contentController.updateContent
);

// DELETE /api/v1/content/:id - Delete content (Admin only)
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  contentController.deleteContent
);

// Episode Management Routes
// POST /api/v1/content/:contentId/seasons/:seasonId/episodes - Add an episode to a season
router.post(
  '/:contentId/seasons/:seasonId/episodes',
  authenticate,
  authorize(['admin']),
  contentUpload,
  contentController.addEpisode
);

// PATCH /api/v1/content/:contentId/seasons/:seasonId/episodes/:episodeId - Update an episode
router.patch(
  '/:contentId/seasons/:seasonId/episodes/:episodeId',
  authenticate,
  authorize(['admin']),
  contentUpload,
  contentController.updateEpisode
);

// DELETE /api/v1/content/:contentId/seasons/:seasonId/episodes/:episodeId - Delete an episode
router.delete(
  '/:contentId/seasons/:seasonId/episodes/:episodeId',
  authenticate,
  authorize(['admin']),
  contentController.deleteEpisode
);

// PATCH /api/v1/content/:id/publish-status - Toggle publish status
router.patch(
  '/:id/publish-status',
  authenticate,
  authorize(['admin']),
  contentController.togglePublishStatus
);

export default router;