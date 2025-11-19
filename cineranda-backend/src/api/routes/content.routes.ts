import { Router } from 'express';
import { ContentController } from '../controllers/content.controller';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth.middleware';
import { checkContentAccess, checkEpisodeAccess } from '../../middleware/contentAccess.middleware';
import { uploadContentFiles } from '../../middleware/upload.middleware';  // ✅ Import uploadContentFiles

const router = Router();
const contentController = new ContentController();

// --- ADMIN-SPECIFIC ROUTES (Must come FIRST before all other routes) ---

// ADMIN: Rating control endpoints
router.patch(
  '/admin/batch-ratings',
  authenticate,
  authorize(['admin']),
  contentController.batchToggleRatings
);

router.patch(
  '/admin/:id/ratings',
  authenticate,
  authorize(['admin']),
  contentController.toggleContentRatings
);

// GET /api/v1/content/admin/movies - Get all movies for admin
router.get(
  '/admin/movies',
  authenticate,
  authorize(['admin']),
  contentController.getAdminMovies
);

// GET /api/v1/content/admin/series/:id - Get single series with full details for admin
router.get(
  '/admin/series/:id',
  authenticate,
  authorize(['admin']),
  contentController.getAdminSeriesById
);

// GET /api/v1/content/admin/series - Get all series with full details for admin
router.get(
  '/admin/series',
  authenticate,
  authorize(['admin']),
  contentController.getAdminSeries
);

// --- PUBLIC ROUTES (no authentication required) ---

// Search (no public prefix in tests)
router.get('/search', contentController.advancedSearch);

// Unlocked content (requires authentication, no public prefix)
router.get('/unlocked', authenticate, contentController.getUnlockedContent);

// Public content routes under /public prefix
router.get('/public/featured', contentController.getFeaturedMovies);
router.get('/public/type/:contentType', contentController.getContentByType);
router.get('/public/movies/genre/:genreId', contentController.getMoviesByGenre);
router.get('/public/movies/category/:categoryId', contentController.getMoviesByCategory);
router.get('/public/movies', contentController.getMovies);

// Trailer access (no authentication required)
router.get('/movies/:id/trailer', contentController.getMovieTrailer);
router.get('/series/:seriesId/seasons/:seasonNumber/episodes/:episodeId/trailer', contentController.getEpisodeTrailer);

// Series routes
router.get('/series/:contentId/seasons/:seasonNumber', contentController.getSeasonDetails);
router.get('/series/:contentId/episodes/:episodeId', contentController.getEpisodeDetails);
router.get('/series/:contentId', optionalAuthenticate, contentController.getSeriesDetails);

// GET /api/v1/content - Get all content (Admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  contentController.getAllContent
);

// Content detail route (public, but needs to come before admin :id route)
// This handles both /content/:contentId for movies and series details
router.get('/:contentId', optionalAuthenticate, contentController.getMovieDetails);

// Access check and watch routes (specific before parameterized)
router.get('/:contentId/access', authenticate, contentController.checkUserAccess);
router.get('/:contentId/watch', authenticate, checkContentAccess, contentController.getWatchContent);
router.get(
  '/series/:contentId/episodes/:episodeId/watch',
  authenticate,
  checkEpisodeAccess,
  contentController.getWatchEpisode
);

// GET /api/v1/content/admin/:id - Get a single piece of content (Admin only)
// Note: This conflicts with :contentId above, so admin should use /admin/content/:id instead
router.get(
  '/admin/content/:id',
  authenticate,
  authorize(['admin']),
  contentController.getContent
);

// POST /api/v1/content - Create new content (Admin only)
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  uploadContentFiles,  // ✅ Use uploadContentFiles from middleware
  contentController.createContent
);

// Add season (admin only) - SPECIFIC before parameterized
router.post(
  '/:contentId/seasons',
  authenticate,
  authorize(['admin']),
  contentController.addSeason
);

// PATCH /api/v1/content/:id - Update existing content (Admin only)
router.patch(
  '/:id',
  authenticate,
  authorize(['admin']),
  uploadContentFiles,  // ✅ Use uploadContentFiles from middleware
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
  uploadContentFiles,  // ✅ Use uploadContentFiles from middleware
  contentController.addEpisode
);

// PATCH /api/v1/content/:contentId/seasons/:seasonId/episodes/:episodeId - Update an episode
router.patch(
  '/:contentId/seasons/:seasonId/episodes/:episodeId',
  authenticate,
  authorize(['admin']),
  uploadContentFiles,  // ✅ Use uploadContentFiles from middleware
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