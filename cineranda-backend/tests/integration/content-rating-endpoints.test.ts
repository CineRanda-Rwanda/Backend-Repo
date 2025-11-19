import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Content } from '../../src/data/models/movie.model';
import { Rating } from '../../src/data/models/rating.model';

// For backward compatibility with test data
const Movie = Content;

describe('Additional Content & Rating Endpoints', () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let movieId: string;
  let seriesId: string;

  beforeEach(async () => {
    const { user, token } = await TestHelpers.createTestUser();
    userToken = token;
    userId = user._id.toString();

    const { admin, token: aToken } = await TestHelpers.createAdminUser();
    adminToken = aToken;

    const movie = await TestHelpers.createTestMovie({ ratingsEnabled: true });
    movieId = movie._id.toString();

    const series = await TestHelpers.createTestSeries(3, { ratingsEnabled: true });
    seriesId = series._id.toString();

    // Purchase content for user
    await TestHelpers.purchaseContent(userId, movieId);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Movie.deleteMany({});
    await Rating.deleteMany({});
  });

  describe('GET /api/v1/content/search - Advanced Search', () => {
    it('should search content with basic query', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=movie');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.results).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.filters).toBeDefined();
    });

    it('should filter by content type', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=test&type=Movie');

      expect(response.status).toBe(200);
      expect(response.body.data.results.every((c: any) => c.contentType === 'Movie')).toBe(true);
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=test&minPrice=500&maxPrice=2000');

      expect(response.status).toBe(200);
      expect(response.body.data.filters.appliedFilters.minPrice).toBe(500);
      expect(response.body.data.filters.appliedFilters.maxPrice).toBe(2000);
    });

    it('should sort by different fields', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=test&sortBy=price&sortOrder=desc');

      expect(response.status).toBe(200);
      expect(response.body.data.results).toBeInstanceOf(Array);
    });

    it('should reject query shorter than 2 characters', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=a');

      expect(response.status).toBe(400);
    });

    it('should return available genres in filters', async () => {
      const response = await request(app)
        .get('/api/v1/content/search?q=test');

      expect(response.status).toBe(200);
      expect(response.body.data.filters.availableGenres).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/content/movies/:id/trailer - Get Movie Trailer', () => {
    it('should get movie trailer info', async () => {
      const response = await request(app)
        .get(`/api/v1/content/movies/${movieId}/trailer`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.movie._id).toBe(movieId);
      expect(response.body.data.movie.title).toBeDefined();
      expect(response.body.data.movie.posterImageUrl).toBeDefined();
    });

    it('should return 404 for non-existent movie', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/v1/content/movies/${fakeId}/trailer`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/content/admin/:id/ratings - Toggle Content Ratings', () => {
    it('should disable ratings for content', async () => {
      const response = await request(app)
        .patch(`/api/v1/content/admin/${movieId}/ratings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ratingsEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.content.ratingsEnabled).toBe(false);
    });

    it('should enable ratings for content', async () => {
      const response = await request(app)
        .patch(`/api/v1/content/admin/${movieId}/ratings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ratingsEnabled: true });

      expect(response.status).toBe(200);
      expect(response.body.data.content.ratingsEnabled).toBe(true);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .patch(`/api/v1/content/admin/${movieId}/ratings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ratingsEnabled: false });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/content/admin/batch-ratings - Batch Toggle Ratings', () => {
    it('should toggle ratings for multiple content items', async () => {
      const response = await request(app)
        .patch('/api/v1/content/admin/batch-ratings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contentIds: [movieId, seriesId],
          ratingsEnabled: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.updatedCount).toBe(2);
      expect(response.body.data.updatedContent).toBeInstanceOf(Array);
      expect(response.body.data.updatedContent.length).toBe(2);
    });

    it('should reject empty content IDs array', async () => {
      const response = await request(app)
        .patch('/api/v1/content/admin/batch-ratings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contentIds: [],
          ratingsEnabled: true,
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .patch('/api/v1/content/admin/batch-ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentIds: [movieId],
          ratingsEnabled: false,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/ratings - Submit Rating', () => {
    beforeAll(async () => {
      // Ensure ratings are enabled
      await Movie.findByIdAndUpdate(movieId, { ratingsEnabled: true });
    });

    it('should submit rating for purchased content', async () => {
      const response = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: movieId,
          rating: 5,
          review: 'Excellent movie!',
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.rating.rating).toBe(5);
      expect(response.body.data.rating.review).toBe('Excellent movie!');
    });

    it('should update existing rating', async () => {
      const response = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: movieId,
          rating: 4,
          review: 'Updated review',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.rating.rating).toBe(4);
    });

    it('should reject rating outside 1-5 range', async () => {
      const response = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: movieId,
          rating: 6,
        });

      expect(response.status).toBe(400);
    });

    it('should reject rating when ratings disabled', async () => {
      await Movie.findByIdAndUpdate(movieId, { ratingsEnabled: false });

      const response = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: movieId,
          rating: 5,
        });

      expect(response.status).toBe(403);

      // Re-enable for other tests
      await Movie.findByIdAndUpdate(movieId, { ratingsEnabled: true });
    });
  });

  describe('GET /api/v1/ratings/:contentId - Get Content Ratings', () => {
    it('should get all ratings for content', async () => {
      const response = await request(app)
        .get(`/api/v1/ratings/${movieId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.ratings).toBeInstanceOf(Array);
      expect(response.body.data.averageRating).toBeDefined();
      expect(response.body.data.totalRatings).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/ratings/${movieId}?page=1&limit=5`);

      expect(response.status).toBe(200);
      expect(response.body.data.ratings.length).toBeLessThanOrEqual(5);
    });
  });

  describe('DELETE /api/v1/ratings/:ratingId - Delete Rating', () => {
    it('should delete own rating', async () => {
      // First get the rating ID (note: Rating model uses movieId field)
      const ratings = await Rating.findOne({ userId, movieId });
      
      if (ratings) {
        const response = await request(app)
          .delete(`/api/v1/ratings/${ratings._id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      }
    });

    it('should reject deleting another user\'s rating', async () => {
      const { user: otherUser, token: otherToken } = await TestHelpers.createTestUser();
      
      // Create rating as other user (note: Rating model uses movieId field)
      await Rating.create({
        userId: otherUser._id,
        movieId: movieId,
        rating: 3,
      });

      const otherRating = await Rating.findOne({ userId: otherUser._id, movieId });
      
      const response = await request(app)
        .delete(`/api/v1/ratings/${otherRating?._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
