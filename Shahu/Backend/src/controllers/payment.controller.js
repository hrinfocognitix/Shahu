const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const paymentIntentService = require('../services/paymentIntent.service');

const create = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createUpiPaymentIntent(req.body || {});
  return apiResponse.success(res, { statusCode: 201, message: 'Payment intent created.', data });
});
const createAuthenticated = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createUpiPaymentIntent(req.body || {}, req.user);
  return apiResponse.success(res, { statusCode: 201, message: 'Payment intent created.', data });
});

const createRazorpayQr = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createRazorpayQrPayment(req.body || {});
  return apiResponse.success(res, { statusCode: 201, message: 'Razorpay payment QR created.', data });
});
const createAuthenticatedRazorpayQr = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createRazorpayQrPayment(req.body || {}, req.user);
  return apiResponse.success(res, { statusCode: 201, message: 'Razorpay payment QR created.', data });
});

const createRazorpayCheckoutOrder = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createRazorpayCheckoutOrder(req.body || {});
  return apiResponse.success(res, { statusCode: 201, message: 'Razorpay order created.', data });
});
const createAuthenticatedRazorpayCheckoutOrder = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.createRazorpayCheckoutOrder(req.body || {}, req.user);
  return apiResponse.success(res, { statusCode: 201, message: 'Razorpay order created.', data });
});

const verifyRazorpayCheckoutPayment = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.verifyRazorpayCheckoutPayment(req.body?.paymentId, req.header('x-payment-token'), req.body || {});
  return apiResponse.success(res, { message: 'Payment verified successfully.', data });
});

const markRazorpayCheckoutFailed = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.markRazorpayCheckoutFailed(req.body?.paymentId, req.header('x-payment-token'), req.body || {});
  return apiResponse.success(res, { message: 'Payment failure recorded.', data });
});

const checkRazorpayPayment = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.reconcileRazorpayPayment(req.params.paymentId, req.header('x-payment-token'));
  return apiResponse.success(res, { message: 'Payment status checked.', data });
});

const reconcileAdminRazorpayPayment = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.reconcileRazorpayPayment(
    req.params.paymentId,
    undefined,
    { adminUser: req.user, ipAddress: req.ip }
  );
  return apiResponse.success(res, {
    message: data.status === 'PAID' ? 'Razorpay confirms this payment was captured.' : 'Razorpay does not show a captured payment yet.',
    data,
  });
});

const razorpayWebhook = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.processRazorpayWebhook(req.body, req.headers);
  return res.status(200).json({ success: true, data });
});

const submit = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.submitPaymentProof(
    req.params.paymentId,
    req.header('x-payment-token'),
    req.body || {}
  );
  return apiResponse.success(res, { message: data.message, data });
});

const status = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.getPaymentStatus(req.params.paymentId, req.header('x-payment-token'));
  return apiResponse.success(res, { message: 'Payment status fetched.', data });
});

const listAdmin = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.listAdminPayments(req.query.status);
  return apiResponse.success(res, { message: 'Payments fetched.', data });
});

const approve = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.approvePayment(req.params.paymentId, req.user, req.ip);
  return apiResponse.success(res, { message: data.alreadyVerified ? 'Payment was already approved.' : 'Payment verified and course access activated.', data });
});

const reject = asyncHandler(async (req, res) => {
  const data = await paymentIntentService.rejectPayment(req.params.paymentId, req.user, req.body?.reason, req.ip);
  return apiResponse.success(res, { message: 'Payment rejected.', data });
});

module.exports = { create, createAuthenticated, createRazorpayQr, createAuthenticatedRazorpayQr, createRazorpayCheckoutOrder, createAuthenticatedRazorpayCheckoutOrder, verifyRazorpayCheckoutPayment, markRazorpayCheckoutFailed, checkRazorpayPayment, reconcileAdminRazorpayPayment, razorpayWebhook, submit, status, listAdmin, approve, reject };
