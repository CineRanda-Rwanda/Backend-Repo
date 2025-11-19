import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User } from '../../src/data/models/user.model';
import { Notification, UserNotification } from '../../src/data/models/notification.model';

describe('Notification Endpoints', () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeEach(async () => {
    const { user, token } = await TestHelpers.createTestUser();
    userToken = token;
    userId = user._id.toString();

    const { admin, token: aToken } = await TestHelpers.createAdminUser();
    adminToken = aToken;
    adminId = admin._id.toString();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});
    await UserNotification.deleteMany({});
  });

  describe('POST /api/v1/notifications/admin/send - Send Notification', () => {
    it('should send broadcast notification to all users', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'broadcast',
          title: 'New Feature Released',
          message: 'Check out our new amazing feature available now!',
          actionType: 'content',
          actionUrl: '/features/new',
          priority: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notificationId).toBeDefined();
      expect(response.body.data.type).toBe('broadcast');
      expect(response.body.data.recipientCount).toBeGreaterThan(0);
    });

    it('should send targeted notification to specific users', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          recipients: [userId],
          title: 'Personal Message',
          message: 'This is a message just for you!',
          actionType: 'wallet',
          actionUrl: '/wallet',
          priority: 'medium',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.recipientCount).toBe(1);
    });

    it('should reject notification with short title', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'broadcast',
          title: 'Hi',
          message: 'This message has a valid length',
          priority: 'low',
        });

      expect(response.status).toBe(400);
    });

    it('should reject notification with short message', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'broadcast',
          title: 'Valid Title',
          message: 'Short',
          priority: 'low',
        });

      expect(response.status).toBe(400);
    });

    it('should reject targeted notification without recipients', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          title: 'Valid Title',
          message: 'This is a valid message length',
          priority: 'low',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'broadcast',
          title: 'Test Notification',
          message: 'This should not be allowed',
          priority: 'low',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/notifications/admin/history - Get Notification History', () => {
    beforeEach(async () => {
      // Send some notifications
      await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'broadcast',
          title: 'Test Broadcast',
          message: 'This is a test broadcast notification',
          priority: 'medium',
        });

      await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          recipients: [userId],
          title: 'Test Targeted',
          message: 'This is a test targeted notification',
          priority: 'high',
        });
    });

    it('should get notification history', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/admin/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications).toBeInstanceOf(Array);
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter by notification type', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/admin/history?type=broadcast')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications.every((n: any) => n.type === 'broadcast')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/admin/history?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should reject non-admin user', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/admin/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/notifications - Get User Notifications', () => {
    beforeEach(async () => {
      // Send notification to user
      await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          recipients: [userId],
          title: 'Test User Notification',
          message: 'This is a test notification for the user',
          priority: 'medium',
        });
    });

    it('should get user notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications).toBeInstanceOf(Array);
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.pagination.unreadCount).toBeDefined();
    });

    it('should filter unread notifications only', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications.every((n: any) => !n.isRead)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?page=1&limit=5')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/notifications');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/notifications/:notificationId/read - Mark Notification as Read', () => {
    let notificationId: string;

    beforeEach(async () => {
      // Send notification
      await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          recipients: [userId],
          title: 'Mark Read Test',
          message: 'This notification will be marked as read',
          priority: 'low',
        });

      // Get notification ID
      const notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);
      
      notificationId = notifs.body.data.notifications[0]._id;
    });

    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.isRead).toBe(true);
      expect(response.body.data.readAt).toBeDefined();
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/v1/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${notificationId}/read`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/notifications/read-all - Mark All Notifications as Read', () => {
    beforeEach(async () => {
      // Send multiple notifications
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/notifications/admin/send')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            type: 'targeted',
            recipients: [userId],
            title: `Bulk Read Test ${i + 1}`,
            message: 'This notification will be marked as read in bulk',
            priority: 'low',
          });
      }
    });

    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.markedCount).toBeGreaterThan(0);

      // Verify all are read
      const notifs = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(notifs.body.data.notifications.length).toBe(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .put('/api/v1/notifications/read-all');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/notifications/:notificationId - Delete Notification', () => {
    let notificationId: string;

    beforeEach(async () => {
      // Send notification
      await request(app)
        .post('/api/v1/notifications/admin/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'targeted',
          recipients: [userId],
          title: 'Delete Test',
          message: 'This notification will be deleted',
          priority: 'low',
        });

      // Get notification ID
      const notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);
      
      notificationId = notifs.body.data.notifications[0]._id;
    });

    it('should delete notification', async () => {
      const response = await request(app)
        .delete(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // Verify deleted
      const notifs = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(notifs.body.data.notifications.find((n: any) => n._id === notificationId)).toBeUndefined();
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/v1/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .delete(`/api/v1/notifications/${notificationId}`);

      expect(response.status).toBe(401);
    });
  });
});
