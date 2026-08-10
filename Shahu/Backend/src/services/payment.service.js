const Razorpay = require('razorpay');
const env = require('../config/env');

function getRazorpayClient() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: env.razorpay.keyId,
    key_secret: env.razorpay.keySecret
  });
}

async function createOrder({ amount, currency = 'INR', receipt }) {
  const client = getRazorpayClient();
  if (!client) {
    return { skipped: true, reason: 'Razorpay is not configured' };
  }
  return client.orders.create({ amount, currency, receipt });
}

function requireRazorpayClient() {
  const client = getRazorpayClient();
  if (!client) throw new Error('Razorpay is not configured');
  return client;
}

async function createSingleUseUpiQr({ name, amountMinor, description, closeBy, notes }) {
  const client = requireRazorpayClient();
  return client.qrCode.create({
    type: 'upi_qr',
    name: String(name).slice(0, 40),
    usage: 'single_use',
    fixed_amount: true,
    payment_amount: amountMinor,
    description: String(description).slice(0, 100),
    close_by: closeBy,
    notes,
  });
}

async function fetchQr(qrId) {
  return requireRazorpayClient().qrCode.fetch(qrId);
}

async function fetchQrPayments(qrId) {
  // Razorpay's Node SDK names the QR-specific payments endpoint
  // `fetchAllPayments` (GET /payments/qr_codes/:id/payments).
  return requireRazorpayClient().qrCode.fetchAllPayments(qrId);
}

async function closeQr(qrId) {
  return requireRazorpayClient().qrCode.close(qrId);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = require('crypto').createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  const received = String(signature);
  return expected.length === received.length && require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!env.razorpay.keySecret || !orderId || !paymentId || !signature) return false;
  const expected = require('crypto').createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return expected.length === String(signature).length && require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
}

async function fetchPayment(paymentId) {
  return requireRazorpayClient().payments.fetch(paymentId);
}

async function fetchOrderPayments(orderId) {
  return requireRazorpayClient().orders.fetchPayments(orderId);
}

module.exports = { createOrder, getRazorpayClient, createSingleUseUpiQr, fetchQr, fetchQrPayments, closeQr, verifyWebhookSignature, verifyCheckoutSignature, fetchPayment, fetchOrderPayments };
