const EmailVerificationOtp = require('../src/models/EmailVerificationOtp');
const { _internals } = require('../src/services/emailOtp.service');

describe('email verification OTP security primitives', () => {
  it('generates a six-digit cryptographically generated OTP shape', () => {
    expect(_internals.generateOtp()).toMatch(/^\d{6}$/);
  });

  it('stores a one-way email-scoped hash, never the plaintext OTP', () => {
    const hash = _internals.hashOtp('user@example.com', '123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('123456');
    expect(_internals.hashOtp('other@example.com', '123456')).not.toBe(hash);
  });

  it('has TTL cleanup, failed-attempt tracking, and a used flag for reuse prevention', () => {
    expect(EmailVerificationOtp.schema.path('expiresAt').options.index).toEqual({ expires: 0 });
    expect(EmailVerificationOtp.schema.path('otpHash').options.select).toBe(false);
    expect(EmailVerificationOtp.schema.path('failedAttempts')).toBeDefined();
    expect(EmailVerificationOtp.schema.path('isUsed')).toBeDefined();
    expect(EmailVerificationOtp.schema.path('otp')).toBeUndefined();
  });

  it('uses the required ten-minute expiration and five-attempt limit', () => {
    expect(_internals.OTP_TTL_MS).toBe(10 * 60 * 1000);
    expect(_internals.MAX_FAILED_ATTEMPTS).toBe(5);
  });

  it('accepts a valid code, rejects an expired code, and rejects five failed attempts', () => {
    const email = 'user@example.com';
    const otpHash = _internals.hashOtp(email, '123456');
    const active = { otpHash, expiresAt: new Date(Date.now() + 1000), failedAttempts: 0, isUsed: false };
    expect(_internals.isOtpUsable(active)).toBe(true);
    expect(_internals.matchesOtp(email, '123456', active.otpHash)).toBe(true);
    expect(_internals.matchesOtp(email, '654321', active.otpHash)).toBe(false);
    expect(_internals.isOtpUsable({ ...active, expiresAt: new Date(Date.now() - 1) })).toBe(false);
    expect(_internals.isOtpUsable({ ...active, failedAttempts: 5 })).toBe(false);
  });

  it('rejects OTP reuse once a successful verification marks it used', () => {
    const usedRecord = { expiresAt: new Date(Date.now() + 1000), failedAttempts: 0, isUsed: true };
    expect(_internals.isOtpUsable(usedRecord)).toBe(false);
  });
});
