import request from 'supertest';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Content } from '../../src/data/models/movie.model';

describe('Payment Endpoints', () => {
  let userToken: string;
  let userId: string;
  let movieId: string;
  let seriesId: string;
  let seasonId: string;
  let episode1Id: string;
  let episode2Id: string;
  let episode3Id: string;

  beforeEach(async () => {
    const { user, token } = await TestHelpers.createTestUser({
      balance: 10000, // Give user enough balance
    });
    userToken = token;
    userId = user._id.toString();

    // Create test movie
    const movie = await TestHelpers.createTestMovie();
    movieId = movie._id.toString();

    // Create test series
    const series = await TestHelpers.createTestSeries(3);
    seriesId = series._id.toString();
    
    if (!series.seasons || !series.seasons[0]) {
      throw new Error('Series seasons not properly initialized');
    }
    
    seasonId = series.seasons[0]._id!.toString();
    episode1Id = series.seasons[0].episodes[0]._id!.toString();
    episode2Id = series.seasons[0].episodes[1]._id!.toString();
    episode3Id = series.seasons[0].episodes[2]._id!.toString();
  });

  /**
   * 1. Unlock Content (Full Series/Movie Purchase)
   */
  describe('POST /api/v1/payments/content/purchase/wallet', () => {
    describe('Movie Purchase', () => {
      it('should purchase movie with wallet balance', async () => {
        const response = await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: movieId })
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'success',
          message: expect.stringContaining('purchased successfully'),
          data: {
            content: {
              _id: movieId,
              title: expect.any(String),
              contentType: 'Movie',
            },
            pricePaid: 1000,
            remainingBalance: 9000,
          },
        });

        // Verify purchase in database
        const user = await User.findById(userId);
        const purchase = user?.purchasedContent?.find(
          (pc: any) => pc.contentId.toString() === movieId
        );
        expect(purchase).toBeDefined();
        expect(purchase?.price).toBe(1000);
      });

      it('should reject purchase with insufficient balance', async () => {
        // Update user balance to low amount
        await User.findByIdAndUpdate(userId, { balance: 100 });

        const response = await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: movieId })
          .expect(400);

        expect(response.body.message).toContain('Insufficient balance');
      });

      it('should reject duplicate purchase', async () => {
        // First purchase
        await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: movieId })
          .expect(200);

        // Second purchase attempt
        const response = await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: movieId })
          .expect(400);

        expect(response.body.message).toContain('already purchased');
      });
    });

    describe('Series Purchase with Episode Snapshot', () => {
      it('should purchase series and capture episode snapshot', async () => {
        const response = await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: seriesId })
          .expect(200);

        expect(response.body.data.content.episodesIncluded).toBe(3);

        // Verify episode snapshot in database
        const user = await User.findById(userId);
        const purchase = user?.purchasedContent?.find(
          (pc: any) => pc.contentId.toString() === seriesId
        );
        
        expect(purchase?.episodeIdsAtPurchase).toBeDefined();
        expect(purchase?.episodeIdsAtPurchase?.length).toBe(3);
        expect(purchase?.episodeIdsAtPurchase).toContain(episode1Id);
        expect(purchase?.episodeIdsAtPurchase).toContain(episode2Id);
        expect(purchase?.episodeIdsAtPurchase).toContain(episode3Id);
      });

      it('should apply series discount when purchasing', async () => {
        const response = await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: seriesId })
          .expect(200);

        // Series has 3 episodes @ 500 RWF = 1500 RWF
        // With 15% discount = 1275 RWF
        expect(response.body.data.pricePaid).toBe(1275);
      });

      it('should block access to episodes added after purchase', async () => {
        // Purchase series
        await request(app)
          .post('/api/v1/payments/content/purchase/wallet')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ contentId: seriesId })
          .expect(200);

        // Admin adds new episode
        const { admin, token: adminToken } = await TestHelpers.createAdminUser();
        await request(app)
          .post(`/api/v1/content/${seriesId}/seasons/${seasonId}/episodes`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            episodeNumber: 4,
            title: 'Episode 4 - Added Later',
            videoUrl: 'https://test.com/ep4.mp4',
            duration: 3600,
            priceInRwf: 500,
          })
          .expect(201);

        // Get updated series
        const seriesResponse = await request(app)
          .get(`/api/v1/content/series/${seriesId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        const newEpisodeId = seriesResponse.body.data.series.seasons[0].episodes[3]._id;

        // Try to watch new episode (should be blocked)
        const watchResponse = await request(app)
          .get(`/api/v1/content/series/${seriesId}/episodes/${newEpisodeId}/watch`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(watchResponse.body.message).toContain('added after you purchased');
      });
    });
  });

  /**
   * 2. Purchase a Season
   */
  describe('POST /api/v1/payments/season/purchase/wallet', () => {
    it('should purchase season with episode snapshot', async () => {
      const response = await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Season purchased successfully',
        data: {
          season: {
            seasonNumber: 1,
            episodeCount: 3,
            episodesIncluded: 3,
          },
          pricing: {
            originalPrice: 1500,
            discount: 15,
            finalPrice: 1275,
          },
        },
      });

      // Verify season purchase with episode snapshot
      const user = await User.findById(userId);
      
      // Type assertion to access purchasedSeasons which might not be in IUser interface
      const userWithSeasons = user as any;
      const seasonPurchase = userWithSeasons?.purchasedSeasons?.find(
        (ps: any) => ps.seasonId.toString() === seasonId
      );

      expect(seasonPurchase).toBeDefined();
      expect(seasonPurchase?.episodeIdsAtPurchase).toHaveLength(3);
      expect(seasonPurchase?.episodeIdsAtPurchase).toContain(episode1Id);
    });

    it('should reject season purchase with insufficient balance', async () => {
      await User.findByIdAndUpdate(userId, { balance: 100 });

      const response = await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient balance');
    });

    it('should reject season purchase if full series already purchased', async () => {
      // Purchase full series first
      await request(app)
        .post('/api/v1/payments/content/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ contentId: seriesId })
        .expect(200);

      // Try to purchase season
      const response = await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(400);

      expect(response.body.message).toContain('already purchased the full series');
    });

    it('should reject duplicate season purchase', async () => {
      // First purchase
      await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(200);

      // Second purchase attempt
      const response = await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(400);

      expect(response.body.message).toContain('already purchased this season');
    });

    it('should block episodes added after season purchase', async () => {
      // Purchase season
      await request(app)
        .post('/api/v1/payments/season/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
        })
        .expect(200);

      // Add new episode
      const newEpisode = await TestHelpers.addEpisodeToSeries(seriesId, 1, {
        episodeNumber: 4,
        title: 'Episode 4',
      });

      // Try to watch new episode
      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}/episodes/${newEpisode._id}/watch`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.message).toContain('added to Season 1 after you purchased');
    });
  });

  /**
   * 3. Unlock Episode (Individual Episode Purchase)
   */
  describe('POST /api/v1/payments/episode/purchase/wallet', () => {
    it('should purchase individual episode', async () => {
      const response = await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Episode purchased successfully',
        data: {
          episode: {
            _id: episode1Id,
            episodeNumber: 1,
          },
          pricing: {
            pricePaid: 500,
          },
          remainingBalance: 9500,
        },
      });

      // Verify purchase
      const user = await User.findById(userId);
      const episodePurchase = user?.purchasedEpisodes?.find(
        (pe: any) => pe.episodeId.toString() === episode1Id
      );
      expect(episodePurchase).toBeDefined();
    });

    it('should allow watching purchased episode', async () => {
      // Purchase episode
      await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(200);

      // Watch episode
      const response = await request(app)
        .get(`/api/v1/content/series/${seriesId}/episodes/${episode1Id}/watch`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.episode.videoUrl).toBeDefined();
    });

    it('should reject episode purchase with insufficient balance', async () => {
      await User.findByIdAndUpdate(userId, { balance: 100 });

      const response = await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient balance');
    });

    it('should reject episode purchase if full series already purchased', async () => {
      // Purchase full series
      await request(app)
        .post('/api/v1/payments/content/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ contentId: seriesId })
        .expect(200);

      // Try to purchase episode
      const response = await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(400);

      expect(response.body.message).toContain('already purchased the full series');
    });

    it('should reject duplicate episode purchase', async () => {
      // First purchase
      await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(200);

      // Second purchase attempt
      const response = await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: episode1Id,
        })
        .expect(400);

      expect(response.body.message).toContain('already purchased this episode');
    });

    it('should allow purchasing locked episode from series purchase', async () => {
      // Purchase series (snapshot created)
      await request(app)
        .post('/api/v1/payments/content/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ contentId: seriesId })
        .expect(200);

      // Add new episode
      const newEpisode = await TestHelpers.addEpisodeToSeries(seriesId, 1, {
        episodeNumber: 4,
      });

      if (!newEpisode._id) {
        throw new Error('New episode _id is undefined');
      }

      // Purchase the new episode individually
      const response = await request(app)
        .post('/api/v1/payments/episode/purchase/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: seriesId,
          seasonNumber: 1,
          episodeId: newEpisode._id.toString(),
        })
        .expect(200);

      expect(response.body.message).toContain('Episode purchased successfully');

      // Should now be able to watch it
      await request(app)
        .get(`/api/v1/content/series/${seriesId}/episodes/${newEpisode._id}/watch`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });
});