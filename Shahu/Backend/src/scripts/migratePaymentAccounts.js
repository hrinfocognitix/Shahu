/*
 * Usage:
 *   node src/scripts/migratePaymentAccounts.js          # preview only
 *   node src/scripts/migratePaymentAccounts.js --apply  # persist safe normalizations
 *
 * Existing mobile numbers are never converted into VPAs. They are marked for admin review.
 */
require('../config/env');
const mongoose = require('mongoose');
const AcademyRecord = require('../models/AcademyRecord');
const { isCompleteUpiId, normalizeUpiId } = require('../services/paymentIntent.service');
const env = require('../config/env');

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(env.mongoUri);
  const accounts = await AcademyRecord.find({ module: 'payment-account', isDeleted: { $ne: true } });
  let valid = 0;
  let needsReview = 0;

  for (const account of accounts) {
    const payload = { ...(account.payload || {}) };
    const upiId = normalizeUpiId(payload.upiId);
    const isValid = isCompleteUpiId(upiId);
    if (isValid) valid += 1;
    else needsReview += 1;

    const nextPayload = {
      ...payload,
      upiId: isValid ? upiId : '',
      upiHandleProvider: isValid ? (payload.upiHandleProvider || upiId.split('@')[1]) : '',
      paymentMode: payload.paymentMode === 'merchant-gateway' ? 'merchant-gateway' : 'direct-upi',
      merchantType: payload.merchantType === 'business' ? 'business' : 'personal',
      merchantDisplayName: payload.merchantDisplayName || payload.accountName || account.title,
      supportsGpay: payload.supportsGpay !== false,
      supportsPhonePe: payload.supportsPhonePe !== false,
      supportsBhim: payload.supportsBhim !== false,
      supportsPaytm: payload.supportsPaytm !== false,
      isQrEnabled: Boolean(payload.isQrEnabled),
      qrType: payload.qrType === 'dynamic' ? 'dynamic' : 'static',
      needsUpiReview: !isValid,
    };
    console.log(`${isValid ? 'VALID' : 'REVIEW'} ${account._id} ${account.title} ${upiId || '(missing)'}`);
    if (apply) {
      account.payload = nextPayload;
      await account.save();
    }
  }
  console.log(`Payment accounts: ${valid} valid, ${needsReview} need a complete UPI ID.`);
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
