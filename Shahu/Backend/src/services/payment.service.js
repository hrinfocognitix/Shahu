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

module.exports = { createOrder };
