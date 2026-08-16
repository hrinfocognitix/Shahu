const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { paymentSubmissionLimiter } = require('../middleware/rateLimit.middleware');
const { authenticateForPurchase } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// This creates a pending payment intent only; no client callback can activate a course.
router.post('/create', paymentController.create);
// Razorpay dynamic QR checkout. Course price is fetched server-side, never accepted from the app.
router.post('/', paymentController.createRazorpayQr);
router.post('/qr', paymentController.createRazorpayQr);
router.post('/checkout/order', paymentController.createRazorpayCheckoutOrder);
router.post('/checkout/verify', paymentController.verifyRazorpayCheckoutPayment);
// React Native Razorpay Standard Checkout aliases.
router.post('/create-order', paymentController.createRazorpayCheckoutOrder);
// Signed-in students buy additional courses using their authenticated account,
// never a form email/mobile or a fresh OTP.
router.post('/student/create', authenticateForPurchase, authorize(ROLES.STUDENT), paymentController.createAuthenticated);
router.post('/student/qr', authenticateForPurchase, authorize(ROLES.STUDENT), paymentController.createAuthenticatedRazorpayQr);
router.post('/student/create-order', authenticateForPurchase, authorize(ROLES.STUDENT), paymentController.createAuthenticatedRazorpayCheckoutOrder);
router.post('/verify', paymentController.verifyRazorpayCheckoutPayment);
router.post('/failed', paymentController.markRazorpayCheckoutFailed);
router.post('/:paymentId/check', paymentController.checkRazorpayPayment);
router.post('/:paymentId/reconcile', paymentController.checkRazorpayPayment);
router.get('/:paymentId', paymentController.status);
router.post('/:paymentId/submit', paymentSubmissionLimiter, paymentController.submit);
router.get('/:paymentId/status', paymentController.status);

module.exports = router;
