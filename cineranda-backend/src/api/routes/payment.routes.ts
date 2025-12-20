import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const paymentController = new PaymentController();

// Wallet routes
router.post('/wallet/topup', authenticate, paymentController.topUpWallet);
router.get('/wallet/balance', authenticate, paymentController.getWalletBalance);

// Content purchase routes
router.post('/content/purchase', authenticate, paymentController.initiateContentPurchase);
router.post('/content/purchase/wallet', authenticate, paymentController.purchaseContentWithWallet); // Legacy alias

// Season purchase routes
router.post('/season/purchase', authenticate, paymentController.initiateSeasonPurchase);
router.post('/season/purchase/wallet', authenticate, paymentController.initiateSeasonPurchase); // Legacy alias

// Episode purchase routes
router.post('/episode/purchase', authenticate, paymentController.initiateEpisodePurchase);
router.post('/episode/purchase/wallet', authenticate, paymentController.initiateEpisodePurchase); // Legacy alias

// Purchase history
router.get('/history', authenticate, paymentController.getUserPurchases);

// Payment callbacks
router.get('/callback', paymentController.handlePaymentCallback);
router.post('/webhook', paymentController.handlePaymentWebhook);

export default router;