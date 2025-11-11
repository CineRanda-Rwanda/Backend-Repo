import request from 'supertest';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Content } from '../../src/data/models/movie.model';

describe('Content/Movie Endpoints', () => {
  let userToken: string;
  let userId: string;
  let movieId: string;
  let seriesId: string;

  beforeEach(async () => {
    const { user, token } = await TestHelpers.createTestUser();
    userToken = token;
    userId = user._id.toString();

    const movie = await TestHelpers.createTestMovie();
    movieId = movie._id.toString();

    const series = await TestHelpers.createTestSeries(3);
    seriesId = series._id.toString();
  });

  /**
   * 1. Get Published Movies
   */
  describe('GET /api/v1/content/public/movies', () => {
    it('should return list of published movies', async () => {
      const response = await request(app)
        .get('/api/v1/content/public/movies')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        results: expect.any(Number),
        data: {
          content: expect.any(Array),
        },
      });

      expect(response.body.data.content.length).toBeGreaterThan(0);
      expect(response.body.data.content[0]).toHaveProperty('title');
      expect(response.body.data.content[0]).toHaveProperty('contentType', 'Movie');
    });

    it('should support pagination', async () => {
      // Create multiple movies
      await TestHelpers.createTestMovie();
      await TestHelpers.createTestMovie();

      const response = await request(app)
        .get('/api/v1/content/public/movies')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.data.content.length).toBeLessThanOrEqual(2);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  /**
   * 2. Search Movies
   */
  describe('GET /api/v1/content/search', () => {
    it('should search movies by title', async () => {
      const specificMovie = await TestHelpers.createTestMovie({ 
        title: 'Inception Test Movie' 
      });

      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ q: 'Inception' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.content.some(
        (c: any) => c.title.includes('Inception')
      )).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ q: 'NonExistentMovieXYZ123' })
        .expect(200);

      expect(response.body.data.content).toEqual([]);
    });
  });

  /**
   * 3. Get Movies by Genre
   */
  describe('GET /api/v1/content/public/movies/genre/:genreId', () => {
    it('should return movies filtered by genre', async () => {
      const movie = await Content.findById(movieId);
      const genreId = movie?.genres[0].toString();

      const response = await request(app)
        .get(`/api/v1/content/public/movies/genre/${genreId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.content).toBeInstanceOf(Array);
    });

    it('should return 404 for invalid genre', async () => {
      const response = await request(app)
        .get('/api/v1/content/public/movies/genre/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.status).toBe('fail');
    });
  });

  /**
   * 4. Get Featured Movies
   */
  describe('GET /api/v1/content/public/featured', () => {
    it('should return featured content', async () => {
      await TestHelpers.createTestMovie({ isFeatured: true });

      const response = await request(app)
        .get('/api/v1/content/public/featured')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('content');
    });
  });

  /**
   * 5. Get Unlocked Content
   */
  describe('GET /api/v1/content/unlocked', () => {
    it('should return unlocked content for authenticated user', async () => {
      // Purchase a movie
      await TestHelpers.purchaseContent(userId, movieId);

      const response = await request(app)
        .get('/api/v1/content/unlocked')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.results.movies).toBeGreaterThan(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/v1/content/unlocked')
        .expect(401);
    });
  });

  /**
   * 6. Get Content by Type
   */
  describe('GET /api/v1/content/public/type/:contentType', () => {
    it('should return movies when type is Movie', async () => {
      const response = await request(app)
        .get('/api/v1/content/public/type/Movie')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.content.every(
        (c: any) => c.contentType === 'Movie'
      )).toBe(true);
    });

    it('should return series when type is Series', async () => {
      const response = await request(app)
        .get('/api/v1/content/public/type/Series')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.content.every(
        (c: any) => c.contentType === 'Series'
      )).toBe(true);
    });
  });

  /**
   * 7. Get Movie Details
   */
  describe('GET /api/v1/content/:contentId', () => {
    it('should return movie details', async () => {
      const response = await request(app)
        .get(`/api/v1/content/${movieId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          content: {
            _id: movieId,
            contentType: 'Movie',
            title: expect.any(String),
          },
        },
      });
    });

    it('should return 404 for non-existent content', async () => {
      await request(app)
        .get('/api/v1/content/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });

  /**
   * 8. Get Series Details
   */
  describe('GET /api/v1/content/series/:contentId', () => {
    it('should return series with user access info', async () => {
      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.series).toHaveProperty('seasons');
      expect(response.body.data.series).toHaveProperty('userAccess');
      expect(response.body.data.series.userAccess).toMatchObject({
        isPurchased: false,
        unlockedEpisodes: expect.any(Array),
      });
    });

    it('should show purchased status after buying', async () => {
      const series = await Content.findById(seriesId);
      if (!series || !series.seasons || !series.seasons[0]) {
        throw new Error('Series or seasons not found');
      }
      const episodeIds = series.seasons[0].episodes.map((ep: any) => ep._id.toString());
      
      await TestHelpers.purchaseContent(userId, seriesId, episodeIds);

      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.series.userAccess.isPurchased).toBe(true);
    });
  });

  /**
   * 9. Get Season Details
   */
  describe('GET /api/v1/content/series/:contentId/seasons/:seasonNumber', () => {
    it('should return season with episodes', async () => {
      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}/seasons/1`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.season).toHaveProperty('episodes');
      expect(response.body.data.season.episodes.length).toBe(3);
    });

    it('should return 404 for non-existent season', async () => {
      await request(app)
        .get(`/api/v1/content/series/${seriesId}/seasons/99`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  /**
   * 10. Get Episode Details
   */
  describe('GET /api/v1/content/series/:contentId/episodes/:episodeId', () => {
    it('should return episode details', async () => {
      const series = await Content.findById(seriesId);
      if (!series || !series.seasons || !series.seasons[0] || !series.seasons[0].episodes[0]) {
        throw new Error('Series, seasons, or episodes not found');
      }
      const episodeId = series.seasons[0].episodes[0]._id!.toString();

      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}/episodes/${episodeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.episode).toMatchObject({
        _id: episodeId,
        title: expect.any(String),
        episodeNumber: 1,
      });
    });
  });

  /**
   * 11. Check Access to Content
   */
  describe('GET /api/v1/content/:contentId/access', () => {
    it('should return no access for unpurchased movie', async () => {
      const response = await request(app)
        .get(`/api/v1/content/${movieId}/access`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        hasAccess: false,
        accessType: 'none',
        contentType: 'Movie',
      });
    });

    it('should return full access after purchase', async () => {
      await TestHelpers.purchaseContent(userId, movieId);

      const response = await request(app)
        .get(`/api/v1/content/${movieId}/access`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        hasAccess: true,
        accessType: 'full',
        contentType: 'Movie',
      });
    });

    it('should show partial access for series with some episodes purchased', async () => {
      const series = await Content.findById(seriesId);
      if (!series || !series.seasons || !series.seasons[0] || !series.seasons[0].episodes[0]) {
        throw new Error('Series, seasons, or episodes not found');
      }
      const episodeId = series.seasons[0].episodes[0]._id!.toString();
      
      await TestHelpers.purchaseEpisode(userId, seriesId, episodeId);

      const response = await request(app)
        .get(`/api/v1/content/${seriesId}/access`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        hasAccess: true,
        accessType: 'partial',
        contentType: 'Series',
      });
    });
  });
});