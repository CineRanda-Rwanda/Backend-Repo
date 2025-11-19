import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Movie } from '../../src/data/models/movie.model';
import { Genre } from '../../src/data/models/genre.model';
import { Category } from '../../src/data/models/category.model';
import { Rating } from '../../src/data/models/rating.model';

describe('User Endpoints', () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let testUser: any;

  beforeEach(async () => {
    const { user, token } = await TestHelpers.createTestUser();
    userToken = token;
    userId = user._id.toString();
    testUser = user;

    const { admin, token: aToken } = await TestHelpers.createAdminUser();
    adminToken = aToken;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Movie.deleteMany({});
    await Genre.deleteMany({});
    await Category.deleteMany({});
    await Rating.deleteMany({});
  });

  describe('GET /api/v1/auth/profile - Get User Profile', () => {
    it('should get authenticated user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id).toBe(userId);
      expect(response.body.data.user.wallet).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/auth/profile - Update User Profile', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          preferredLanguage: 'english',
          theme: 'dark',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.firstName).toBe('John');
      expect(response.body.data.user.lastName).toBe('Doe');
      expect(response.body.data.user.preferredLanguage).toBe('english');
      expect(response.body.data.user.theme).toBe('dark');
    });

    it('should reject invalid language', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          preferredLanguage: 'spanish',
        });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/profile')
        .send({ firstName: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/payments/wallet/balance - Get Wallet Balance', () => {
    it('should get user wallet balance', async () => {
      const response = await request(app)
        .get('/api/v1/payments/wallet/balance')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.wallet).toBeDefined();
      expect(response.body.data.wallet.balance).toBeDefined();
      expect(response.body.data.wallet.bonusBalance).toBeDefined();
      expect(response.body.data.wallet.totalBalance).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/payments/wallet/balance');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/users/:userId/adjust-balance - Adjust User Balance', () => {
    it('should add bonus to user wallet', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/adjust-balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 5000,
          type: 'credit',
          category: 'bonus',
          description: 'Promotional bonus',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.newBalance).toBeDefined();
      expect(response.body.data.newBalance).toBeGreaterThan(0);
    });

    it('should deduct from user wallet', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/adjust-balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000,
          type: 'debit',
          category: 'adjustment',
          description: 'Correction',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.newBalance).toBeDefined();
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/adjust-balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: -100,
          type: 'credit',
          category: 'bonus',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/adjust-balance`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 1000,
          type: 'credit',
          category: 'bonus',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/users - Get All Users', () => {
    it('should get all users for admin', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.users).toBeInstanceOf(Array);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeLessThanOrEqual(5);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/users/:userId - Get User by ID', () => {
    it('should get specific user details', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id).toBe(userId);
      expect(response.body.data.user.wallet).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/users/:userId - Update User', () => {
    it('should update user as admin', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'AdminUpdated',
          isActive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.firstName).toBe('AdminUpdated');
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'Hacker',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/users/:userId - Delete User', () => {
    it('should deactivate user instead of deleting', async () => {
      const { user: testUser } = await TestHelpers.createTestUser();
      
      const response = await request(app)
        .delete(`/api/v1/users/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);

      // Verify user is deactivated
      const checkUser = await User.findById(testUser._id);
      expect(checkUser?.isActive).toBe(false);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
