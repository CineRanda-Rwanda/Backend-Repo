import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Settings } from '../../src/data/models/settings.model';

describe('Authentication Endpoints', () => {
  let adminToken: string;

  beforeAll(async () => {
    const { token } = await TestHelpers.createAdminUser();
    adminToken = token;

    // Create settings for welcome bonus
    await Settings.create({
      welcomeBonusAmount: 500,
      currency: 'RWF',
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Settings.deleteMany({});
  });

  describe('POST /api/v1/auth/request-verification', () => {
    it('should send verification code to phone number', async () => {
      const phoneNumber = `+25079${Math.floor(Math.random() * 10000000)}`;

      const response = await request(app)
        .post('/api/v1/auth/request-verification')
        .send({ phoneNumber });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('verification code sent');
    });

    it('should reject invalid phone number format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-verification')
        .send({ phoneNumber: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/verify-registration', () => {
    it('should complete registration with valid verification code', async () => {
      // Recreate settings (gets deleted by afterEach)
      await Settings.create({
        welcomeBonusAmount: 500,
        currency: 'RWF',
      });

      const phoneNumber = `+25079${Math.floor(Math.random() * 10000000)}`;
      const username = `testuser_${Date.now()}`;
      
      // Request verification
      await request(app)
        .post('/api/v1/auth/request-verification')
        .send({ phoneNumber });

      // Get verification code from database (need to select it explicitly)
      const user = await User.findOne({ phoneNumber }).select('+verificationCode');
      const verificationCode = user?.verificationCode;

      const response = await request(app)
        .post('/api/v1/auth/verify-registration')
        .send({
          phoneNumber,
          verificationCode,
          username,
          pin: '1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.username).toBe(username);
      expect(response.body.data.user.wallet).toBeDefined();
      expect(response.body.data.user.wallet.bonusBalance).toBe(500); // Welcome bonus
      expect(response.body.data.welcomeBonus).toBeDefined();
    });

    it('should reject invalid verification code', async () => {
      const phoneNumber = `+25079${Math.floor(Math.random() * 10000000)}`;

      const response = await request(app)
        .post('/api/v1/auth/verify-registration')
        .send({
          phoneNumber,
          verificationCode: '000000',
          username: 'test',
          pin: '1234',
        });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate username', async () => {
      const { user } = await TestHelpers.createTestUser();
      const phoneNumber = `+25079${Math.floor(Math.random() * 10000000)}`;

      await request(app)
        .post('/api/v1/auth/request-verification')
        .send({ phoneNumber });

      const newUser = await User.findOne({ phoneNumber });
      const verificationCode = newUser?.verificationCode;

      const response = await request(app)
        .post('/api/v1/auth/verify-registration')
        .send({
          phoneNumber,
          verificationCode,
          username: user.username, // Duplicate
          pin: '1234',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { user } = await TestHelpers.createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phoneNumber: user.phoneNumber,
          pin: '1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.phoneNumber).toBe(user.phoneNumber);
    });

    it('should reject invalid PIN', async () => {
      const { user } = await TestHelpers.createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phoneNumber: user.phoneNumber,
          pin: '9999',
        });

      expect(response.status).toBe(401);
    });

    it('should reject non-existent phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phoneNumber: '+250790000000',
          pin: '1234',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/admin/refresh-token', () => {
    it('should refresh admin access token', async () => {
      // Recreate admin user (gets deleted by afterEach)
      const { token: newAdminToken } = await TestHelpers.createAdminUser();

      const response = await request(app)
        .post('/api/v1/auth/admin/refresh-token')
        .set('Authorization', `Bearer ${newAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe(86400);
      expect(response.body.data.tokenType).toBe('Bearer');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/refresh-token')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/refresh-token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should get authenticated user profile', async () => {
      const { user, token } = await TestHelpers.createTestUser();

      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(user.username);
      expect(response.body.data.user.phoneNumber).toBe(user.phoneNumber);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile');

      expect(response.status).toBe(401);
    });
  });
});
