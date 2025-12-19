import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { TestHelpers } from '../helpers/testHelpers';
import { User, IUser } from '../../src/data/models/user.model';

describe('Auth security endpoints', () => {
  describe('Password recovery and change', () => {
    it('creates a password reset token for a known email', async () => {
      const { user } = await TestHelpers.createEmailUser();

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      expect(response.body.status).toBe('success');
      const updatedUser = await User.findById(user._id).select('+passwordResetToken +passwordResetExpires');
      expect(updatedUser?.passwordResetToken).toBeDefined();
      expect(updatedUser?.passwordResetExpires).toBeInstanceOf(Date);
    });

    it('resets password when provided a valid token', async () => {
      const { user } = await TestHelpers.createEmailUser();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.findByIdAndUpdate(user._id, {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPass123!' })
        .expect(200);

      expect(response.body.status).toBe('success');
      const updatedUser = await User.findById(user._id).select('+password') as IUser | null;
      expect(updatedUser).not.toBeNull();
      const isValid = await updatedUser!.comparePassword('NewPass123!');
      expect(isValid).toBe(true);
      expect(updatedUser!.passwordResetToken).toBeUndefined();
    });

    it('rejects password reset attempts with invalid tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'Another123!' })
        .expect(400);

      expect(response.body.message).toContain('invalid');
    });

    it('allows authenticated users to change their password', async () => {
      const { user, token, plainPassword } = await TestHelpers.createEmailUser();

      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: plainPassword, newPassword: 'FreshPass123!' })
        .expect(200);

      const updatedUser = await User.findById(user._id).select('+password') as IUser | null;
      const isValid = await updatedUser!.comparePassword('FreshPass123!');
      expect(isValid).toBe(true);
    });

    it('rejects password change when current password is wrong', async () => {
      const { token } = await TestHelpers.createEmailUser();

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword!', newPassword: 'FreshPass123!' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('incorrect');
    });
  });

  describe('PIN recovery and change', () => {
    it('creates a PIN reset code via forgot-pin', async () => {
      const { user } = await TestHelpers.createTestUser();

      await request(app)
        .post('/api/v1/auth/forgot-pin')
        .send({ phoneNumber: user.phoneNumber })
        .expect(200);

      const updatedUser = await User.findById(user._id).select('+pinResetCode +pinResetExpires');
      expect(updatedUser?.pinResetCode).toBeDefined();
      expect(updatedUser?.pinResetExpires).toBeInstanceOf(Date);
    });

    it('resets PIN when provided a valid code', async () => {
      const { user } = await TestHelpers.createTestUser();

      await request(app)
        .post('/api/v1/auth/forgot-pin')
        .send({ phoneNumber: user.phoneNumber })
        .expect(200);

      const userWithCode = await User.findById(user._id).select('+pinResetCode +pinResetExpires');
      const resetCode = userWithCode?.pinResetCode;
      expect(resetCode).toBeDefined();
      if (!resetCode) {
        throw new Error('PIN reset code was not generated');
      }

      await request(app)
        .post('/api/v1/auth/reset-pin')
        .send({ code: resetCode, newPin: '4321' })
        .expect(200);

      const updatedUser = await User.findById(user._id).select('+pin') as IUser | null;
      const isValid = await updatedUser!.comparePin('4321');
      expect(isValid).toBe(true);
    });

    it('allows authenticated users to change their PIN', async () => {
      const { user, token } = await TestHelpers.createTestUser();

      await request(app)
        .post('/api/v1/auth/change-pin')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPin: '1234', newPin: '5678' })
        .expect(200);

      const updatedUser = await User.findById(user._id).select('+pin') as IUser | null;
      const isValid = await updatedUser!.comparePin('5678');
      expect(isValid).toBe(true);
    });

    it('rejects PIN change when the old PIN is wrong', async () => {
      const { token } = await TestHelpers.createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/change-pin')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPin: '0000', newPin: '5678' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('incorrect');
    });
  });
});
