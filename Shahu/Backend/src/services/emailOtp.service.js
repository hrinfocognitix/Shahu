const crypto = require('crypto');
const EmailVerificationOtp = require('../models/EmailVerificationOtp');
const User = require('../models/User');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { sendEmail } = require('./email.service');

const OTP_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_FAILED_ATTEMPTS = 5;
const INVALID_OTP_MESSAGE = 'Invalid or expired verification code.';

const normalizeEmail = email => String(email || '').trim().toLowerCase();
// HMAC keeps the one-way value server-secret scoped; plaintext OTPs are never persisted.
const hashOtp = (email, otp) => crypto.createHmac('sha256', env.otp.hmacSecret).update(`email-verification:${email}:${otp}`).digest('hex');
const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const secureEqual = (left, right) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const isOtpUsable = (record, now = new Date()) => Boolean(record && !record.isUsed && record.expiresAt > now && record.failedAttempts < MAX_FAILED_ATTEMPTS);
const matchesOtp = (email, otp, hash) => secureEqual(hashOtp(email, otp), hash);

async function requestEmailOtp(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const now = new Date();
  const existing = await EmailVerificationOtp.findOne({ email }).select('+otpHash');
  const windowExpired = !existing || !existing.requestWindowStartedAt || now - existing.requestWindowStartedAt >= REQUEST_WINDOW_MS;

  // Same generic result for throttled requests prevents account enumeration.
  if (existing && !windowExpired && existing.lastSentAt && now - existing.lastSentAt < COOLDOWN_MS) return { delivered: false, throttled: true };
  if (existing && !windowExpired && existing.requestCount >= MAX_REQUESTS_PER_EMAIL) return { delivered: false, throttled: true };

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const requestCount = windowExpired ? 1 : (existing?.requestCount || 0) + 1;
  await EmailVerificationOtp.findOneAndUpdate(
    { email },
    {
      email,
      otpHash: hashOtp(email, otp),
      expiresAt,
      isUsed: false,
      verifiedAt: null,
      failedAttempts: 0,
      requestCount,
      requestWindowStartedAt: windowExpired ? now : existing.requestWindowStartedAt,
      lastSentAt: now,
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );

  const delivery = await sendEmail({
    to: email,
    subject: 'Verify your email address',
    text: `Your verification code is ${otp}. This code expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Your verification code is <strong style="font-size:24px;letter-spacing:4px">${otp}</strong>.</p><p>This code expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
  });
  if (delivery?.skipped) throw new AppError('Email delivery is not configured.', STATUS_CODES.SERVICE_UNAVAILABLE);
  return { delivered: true, expiresAt };
}

async function verifyEmailOtp(rawEmail, otp) {
  const email = normalizeEmail(rawEmail);
  const record = await EmailVerificationOtp.findOne({ email }).select('+otpHash');
  if (!isOtpUsable(record)) throw new AppError(INVALID_OTP_MESSAGE, STATUS_CODES.UNAUTHORIZED);

  if (!matchesOtp(email, otp, record.otpHash)) {
    record.failedAttempts += 1;
    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) record.isUsed = true;
    await record.save();
    throw new AppError(INVALID_OTP_MESSAGE, STATUS_CODES.UNAUTHORIZED);
  }

  record.isUsed = true; // Mark before returning, permanently preventing reuse.
  record.verifiedAt = new Date();
  await record.save();
  // Does not disclose whether a User exists; it simply verifies a matching account when present.
  await User.updateOne({ email }, { $set: { emailVerified: true } });
  return { verifiedAt: record.verifiedAt };
}

module.exports = { requestEmailOtp, verifyEmailOtp, _internals: { generateOtp, hashOtp, normalizeEmail, isOtpUsable, matchesOtp, OTP_TTL_MS, MAX_FAILED_ATTEMPTS } };
