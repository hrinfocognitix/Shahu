const LoginOtp = require('../src/models/LoginOtp');
const { _internals } = require('../src/services/auth.service');

describe('student login OTP', () => {
  it('stores a one-way user-scoped OTP hash', () => {
    const first = _internals.otpHash('student-1', '123456');
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('123456');
    expect(_internals.otpHash('student-2', '123456')).not.toBe(first);
  });

  it('uses a TTL record without a plaintext code field', () => {
    expect(LoginOtp.schema.path('expiresAt').options.index).toEqual({ expires: 0 });
    expect(LoginOtp.schema.path('codeHash').options.select).toBe(false);
    expect(LoginOtp.schema.path('code')).toBeUndefined();
  });
});
