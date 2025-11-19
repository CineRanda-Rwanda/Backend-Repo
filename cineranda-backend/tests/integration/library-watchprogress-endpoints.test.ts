import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { Content } from '../../src/data/models/movie.model';
import { Library } from '../../src/data/models/library.model';
import { WatchProgress } from '../../src/data/models/watchProgress.model';
import { Purchase } from '../../src/data/models/purchase.model';

describe('Library and Watch Progress Endpoints', () => {
  let authToken: string;
  let userId: string;
  let movieId: string;
  let seriesId: string;

  beforeEach(async () => {
    // Use test helpers like other tests
    const { user, token } = await TestHelpers.createTestUser();
    userId = user._id.toString();
    authToken = token;

    // Create a test genre (required field)
    const genre = await mongoose.connection.collection('genres').insertOne({
      name: 'Test Genre',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create test movie
    const movie = await Content.create({
      title: 'Test Movie for Library',
      description: 'A test movie',
      contentType: 'Movie',
      duration: 120,
      releaseYear: 2024,
      price: 5000,
      posterImageUrl: 's3://test-poster.jpg',
      videoUrl: 's3://test-movie.mp4',
      thumbnailUrl: 's3://test-thumbnail.jpg',
      movieFileUrl: 's3://test-movie.mp4',
      isPublished: true,
      genres: [genre.insertedId]
    });
    movieId = (movie._id as mongoose.Types.ObjectId).toString();

    // Create test series
    const series = await Content.create({
      title: 'Test Series for Library',
      description: 'A test series',
      contentType: 'Series',
      releaseYear: 2024,
      posterImageUrl: 's3://test-series-poster.jpg',
      videoUrl: 's3://test-series.mp4',
      thumbnailUrl: 's3://test-series-thumbnail.jpg',
      isPublished: true,
      genres: [genre.insertedId],
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            {
              episodeNumber: 1,
              title: 'Episode 1',
              description: 'Test episode',
              videoUrl: 's3://test-episode1.mp4',
              thumbnailUrl: 's3://test-thumbnail1.jpg',
              duration: 45,
              price: 2000,
              isFree: false
            }
          ]
        }
      ]
    });
    seriesId = (series._id as mongoose.Types.ObjectId).toString();
  });

  afterEach(async () => {
    // Clean up test data
    await Content.deleteMany({});
    await Library.deleteMany({});
    await WatchProgress.deleteMany({});
    await Purchase.deleteMany({});
    await mongoose.connection.collection('users').deleteMany({});
    await mongoose.connection.collection('genres').deleteMany({});
  });

  describe('POST /library - Add to Library', () => {
    it('should add a movie to user library', async () => {
      const response = await request(app)
        .post('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Content added to library');
      expect(response.body.data.libraryItem).toHaveProperty('_id');
      expect(response.body.data.libraryItem.contentId).toBe(movieId);
      expect(response.body.data.libraryItem.contentType).toBe('Movie');
    });

    it('should add a series to user library', async () => {
      const response = await request(app)
        .post('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: seriesId,
          contentType: 'Series'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.libraryItem.contentType).toBe('Series');
    });

    it('should return 409 if content already in library', async () => {
      // Add first time
      await request(app)
        .post('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie'
        });

      // Try to add again
      const response = await request(app)
        .post('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie'
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Content already in library');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/library')
        .send({
          contentId: movieId,
          contentType: 'Movie'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /library - Get User Library', () => {
    beforeEach(async () => {
      // Add some content to library
      await Library.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId,
        contentType: 'Movie'
      });

      await Library.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: seriesId,
        contentType: 'Series'
      });
    });

    it('should get user library with populated content', async () => {
      const response = await request(app)
        .get('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.library).toHaveLength(2);
      expect(response.body.data.library[0].content).toHaveProperty('title');
      expect(response.body.data.library[0].content).toHaveProperty('isUnlocked');
      expect(response.body.data.pagination).toHaveProperty('currentPage');
      expect(response.body.data.pagination).toHaveProperty('totalItems');
    });

    it('should filter library by content type', async () => {
      const response = await request(app)
        .get('/api/v1/library?contentType=Movie')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.library).toHaveLength(1);
      expect(response.body.data.library[0].content.contentType).toBe('Movie');
    });

    it('should show isUnlocked=false for unpurchased content', async () => {
      const response = await request(app)
        .get('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.library[0].content.isUnlocked).toBe(false);
    });

    it('should show isUnlocked=true for purchased content', async () => {
      // Create a purchase record
      await Purchase.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId,
        contentType: 'Movie',
        amountPaid: 5000,
        paymentMethod: 'wallet',
        transactionId: 'test-tx-123',
        transactionRef: 'test-ref-123',
        status: 'completed',
        purchaseType: 'content'
      });

      const response = await request(app)
        .get('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const movieItem = response.body.data.library.find(
        (item: any) => item.content.contentType === 'Movie'
      );
      expect(movieItem.content.isUnlocked).toBe(true);
    });
  });

  describe('DELETE /library/:contentId - Remove from Library', () => {
    beforeEach(async () => {
      await Library.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId,
        contentType: 'Movie'
      });
    });

    it('should remove content from library', async () => {
      const response = await request(app)
        .delete(`/api/v1/library/${movieId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Content removed from library');

      // Verify it's removed
      const libraryCount = await Library.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId
      });
      expect(libraryCount).toBe(0);
    });

    it('should return 404 if content not in library', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/library/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Content not found in library');
    });
  });

  describe('POST /watch-progress - Save Watch Progress', () => {
    it('should save watch progress for a movie', async () => {
      const response = await request(app)
        .post('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie',
          progress: 3600,
          duration: 7200
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Watch progress saved');
      expect(response.body.data.watchProgress.progress).toBe(3600);
      expect(response.body.data.watchProgress.percentageWatched).toBe(50);
      expect(response.body.data.watchProgress.isCompleted).toBe(false);
    });

    it('should mark content as completed when progress > 95%', async () => {
      const response = await request(app)
        .post('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie',
          progress: 6900,
          duration: 7200
        });

      expect(response.status).toBe(200);
      expect(response.body.data.watchProgress.percentageWatched).toBeGreaterThan(95);
      expect(response.body.data.watchProgress.isCompleted).toBe(true);
    });

    it('should update existing progress', async () => {
      // Save initial progress
      await request(app)
        .post('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie',
          progress: 1800,
          duration: 7200
        });

      // Update progress
      const response = await request(app)
        .post('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: movieId,
          contentType: 'Movie',
          progress: 3600,
          duration: 7200
        });

      expect(response.status).toBe(200);
      expect(response.body.data.watchProgress.progress).toBe(3600);

      // Verify only one record exists
      const count = await WatchProgress.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId
      });
      expect(count).toBe(1);
    });
  });

  describe('GET /watch-progress/:contentId - Get Watch Progress', () => {
    beforeEach(async () => {
      await WatchProgress.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId,
        contentType: 'Movie',
        progress: 3600,
        duration: 7200,
        lastWatchedAt: new Date()
      });
    });

    it('should get watch progress for specific content', async () => {
      const response = await request(app)
        .get(`/api/v1/watch-progress/${movieId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.watchProgress.progress).toBe(3600);
      expect(response.body.data.watchProgress.percentageWatched).toBe(50);
    });

    it('should return 404 if no progress found', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/v1/watch-progress/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('No watch progress found for this content');
    });
  });

  describe('GET /watch-progress - Continue Watching', () => {
    beforeEach(async () => {
      // Add multiple watch progress items
      await WatchProgress.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: movieId,
        contentType: 'Movie',
        progress: 3600,
        duration: 7200,
        lastWatchedAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      });

      await WatchProgress.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: seriesId,
        contentType: 'Movie',
        progress: 2000,
        duration: 4000,
        lastWatchedAt: new Date() // Just now
      });
    });

    it('should get continue watching list', async () => {
      const response = await request(app)
        .get('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.continueWatching).toHaveLength(2);
      expect(response.body.data.continueWatching[0].content).toHaveProperty('title');
    });

    it('should exclude completed content by default', async () => {
      // Mark one as completed
      await WatchProgress.create({
        userId: new mongoose.Types.ObjectId(userId),
        contentId: new mongoose.Types.ObjectId(),
        contentType: 'Movie',
        progress: 7000,
        duration: 7200,
        lastWatchedAt: new Date()
      });

      const response = await request(app)
        .get('/api/v1/watch-progress')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.continueWatching).toHaveLength(2); // Should not include completed one
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/watch-progress?limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.continueWatching).toHaveLength(1);
    });
  });
});
