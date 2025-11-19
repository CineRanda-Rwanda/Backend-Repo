import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Movie } from '../../src/data/models/movie.model';
import { Purchase } from '../../src/data/models/purchase.model';

describe('Analytics Endpoints', () => {
  let adminToken: string;
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    const { admin, token } = await TestHelpers.createAdminUser();
    adminToken = token;

    const { user, token: uToken } = await TestHelpers.createTestUser();
    userToken = uToken;
    userId = user._id.toString();

    // Create some test data for analytics
    const movie1 = await TestHelpers.createTestMovie({ price: 2000, isPublished: true });
    const movie2 = await TestHelpers.createTestMovie({ price: 3000, isPublished: true });
    const series = await TestHelpers.createTestSeries(3, { isPublished: true });

    // Create purchases with correct schema
    await Purchase.create({
      userId,
      contentId: movie1._id,
      contentType: 'Movie', // This is different from purchaseType
      purchaseType: 'content', // This is the enum field
      amountPaid: 2000,
      paymentMethod: 'wallet',
      transactionId: `txn_${Date.now()}_1`,
      transactionRef: `ref_${Date.now()}_1`,
      status: 'completed',
    });

    await Purchase.create({
      userId,
      contentId: movie2._id,
      contentType: 'Movie',
      purchaseType: 'content',
      amountPaid: 3000,
      paymentMethod: 'wallet',
      transactionId: `txn_${Date.now()}_2`,
      transactionRef: `ref_${Date.now()}_2`,
      status: 'completed',
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Movie.deleteMany({});
    await Purchase.deleteMany({});
  });

  describe('GET /api/v1/admin/analytics/dashboard - Dashboard Analytics', () => {
    it('should get comprehensive dashboard stats', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.overview.totalUsers).toBeGreaterThan(0);
      expect(response.body.data.overview.activeUsers).toBeDefined();
      expect(response.body.data.content).toBeDefined();
      expect(response.body.data.content.totalContent).toBeGreaterThan(0);
      expect(response.body.data.revenue).toBeDefined();
      expect(response.body.data.revenue.currency).toBe('RWF');
      expect(response.body.data.transactions).toBeDefined();
      expect(response.body.data.walletStats).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/analytics/revenue - Revenue Analytics', () => {
    it('should get revenue analytics with default grouping', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(response.body.data.byDate).toBeInstanceOf(Array);
      expect(response.body.data.byContentType).toBeDefined();
      expect(response.body.data.topRevenueContent).toBeInstanceOf(Array);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/v1/admin/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary.period).toBeDefined();
      expect(response.body.data.summary.period.startDate).toBe(startDate);
      expect(response.body.data.summary.period.endDate).toBe(endDate);
    });

    it('should support different groupBy options', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/revenue?groupBy=week')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.byDate).toBeInstanceOf(Array);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/revenue')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/analytics/user-growth - User Growth Analytics', () => {
    it('should get user growth metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/user-growth')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalUsers).toBeGreaterThan(0);
      expect(response.body.data.summary.activeUsers).toBeDefined();
      expect(response.body.data.summary.churnRate).toBeDefined();
      expect(response.body.data.summary.retentionRate).toBeDefined();
      expect(response.body.data.growthByDate).toBeInstanceOf(Array);
      expect(response.body.data.userActivity).toBeDefined();
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/v1/admin/analytics/user-growth?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/user-growth')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/analytics/content-performance - Content Performance', () => {
    it('should get content performance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/content-performance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.topPerformers).toBeInstanceOf(Array);
      expect(response.body.data.ratingStatistics).toBeDefined();
      expect(response.body.data.ratingStatistics.averageRating).toBeDefined();
      expect(response.body.data.ratingStatistics.ratingsDistribution).toBeDefined();
    });

    it('should filter by content type', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/content-performance?contentType=Movie')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.topPerformers.every((c: any) => c.type === 'Movie')).toBe(true);
    });

    it('should support different sort options', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/content-performance?sortBy=rating&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.topPerformers.length).toBeLessThanOrEqual(5);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/content-performance')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/analytics/wallet-stats - Wallet Statistics', () => {
    it('should get wallet statistics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/wallet-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.totals).toBeDefined();
      expect(response.body.data.totals.totalWalletBalance).toBeDefined();
      expect(response.body.data.totals.totalBonusBalance).toBeDefined();
      expect(response.body.data.totals.averageUserBalance).toBeDefined();
      expect(response.body.data.topups).toBeDefined();
      expect(response.body.data.balanceDistribution).toBeInstanceOf(Array);
    });

    it('should have proper balance distribution ranges', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/wallet-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const distribution = response.body.data.balanceDistribution;
      expect(distribution.every((d: any) => d.range && d.userCount !== undefined && d.percentage !== undefined)).toBe(true);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/wallet-stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/analytics/platform-health - Platform Health', () => {
    it('should get platform health metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/platform-health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.system).toBeDefined();
      expect(response.body.data.system.uptime).toBeDefined();
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.api).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/admin/analytics/platform-health')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
