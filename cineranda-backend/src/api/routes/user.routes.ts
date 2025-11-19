import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Protect all routes
router.use(authenticate);
router.use(authorize(['admin']));

// GET /api/v1/users/by-phone - Find user by phone number
router.get('/by-phone', userController.getUserByPhone);

// GET /api/v1/users - Get all users
router.get('/', userController.getAllUsers);

// GET /api/v1/users/:id - Get a specific user
router.get('/:id', userController.getUser);

// PUT /api/v1/users/:id - Update user details
router.put('/:id', userController.updateUser);

// PATCH /api/v1/users/:id/role - Update user's role
router.patch('/:id/role', userController.updateUserRole);

// PATCH /api/v1/users/:id/status - Toggle user status (ban/unban)
router.patch('/:id/status', userController.toggleUserStatus);

// POST /api/v1/users/:id/reset-pin - Reset user's PIN
router.post('/:id/reset-pin', userController.resetUserPIN);

// POST /api/v1/users/:id/coins - Adjust user's coin balance (legacy)
router.post('/:id/coins', userController.adjustCoins);

// POST /api/v1/users/:id/adjust-balance - Adjust user's unified wallet balance (new)
router.post('/:id/adjust-balance', userController.adjustBalance);

// GET /api/v1/users/:id/transactions - Get user's transactions
router.get('/:id/transactions', userController.getUserTransactions);

// DELETE /api/v1/users/:id - Delete a user
router.delete('/:id', userController.deleteUser);

export default router;