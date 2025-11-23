import request from 'supertest';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';

describe('Admin Auth Endpoints', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const admin = await TestHelpers.createAdminUser();
    adminToken = admin.token;

    const user = await TestHelpers.createTestUser();
    userToken = user.token;
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/admin/change-password', () => {
    it('should allow admin to change their own password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should deny access to non-admin user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'password123', // Assuming user has this password (TestHelpers usually sets pin, not password for users)
          newPassword: 'newpassword123'
        });

      // Should be 403 Forbidden
      expect(response.status).toBe(403);
    });
  });
});
