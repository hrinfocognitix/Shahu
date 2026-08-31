const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const authRepository = require('../repositories/auth.repository');
const { comparePassword, hashPassword } = require('../helpers/bcrypt.helper');
const crypto = require('crypto');
const env = require('../config/env');
const { ROLES } = require('../constants/roles');
const LoginOtp = require('../models/LoginOtp');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { sendEmail } = require('./email.service');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../helpers/jwt.helper');

function tokenPayload(user) {
  return {
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    sv: Number(user.authVersion || 0),
  };
}

function issueTokens(user) {
  const payload = tokenPayload(user);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

async function register(payload) {
  const existing = await authRepository.findUserByEmailWithSecrets(payload.email);
  if (existing) {
    throw new AppError('Email already registered', STATUS_CODES.CONFLICT);
  }

  const user = await authRepository.createUser({
    ...payload,
    password: await hashPassword(payload.password),
  });
  const tokens = issueTokens(user);
  user.refreshTokens = [tokens.refreshToken];
  await user.save();
  return { user, tokens };
}

async function login({ email, identifier, password }) {
  const user = identifier
    ? await authRepository.findByLoginIdentifier(identifier)
    : await authRepository.findUserByEmailWithSecrets(String(email).trim().toLowerCase());
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', STATUS_CODES.UNAUTHORIZED);
  }
  if (!user.isActive) {
    throw new AppError('Account is disabled', STATUS_CODES.FORBIDDEN);
  }
  if (user.role === ROLES.STUDENT) await requireActiveStudentEnrollment(user._id);

  // Students may change a temporary password later from their profile. Clearing this
  // legacy flag after a successful password login prevents it from blocking the app.
  if (user.mustChangePassword) user.mustChangePassword = false;
  if (user.profile && Object.prototype.hasOwnProperty.call(user.profile, 'gender')) {
    const gender = String(user.profile.gender || '').trim().toLowerCase();
    user.profile.gender = ['male', 'female', 'other'].includes(gender) ? gender : '';
  }
  user.authVersion = Number(user.authVersion || 0) + 1;
  const tokens = issueTokens(user);
  user.refreshTokens = [tokens.refreshToken];
  user.lastLoginAt = new Date();
  await user.save();
  return { user, tokens };
}

const otpHash = (userId, code) =>
  crypto
    .createHmac('sha256', env.jwt.accessSecret)
    .update(`student-login:${userId}:${code}`)
    .digest('hex');

async function requireActiveStudentEnrollment(userId) {
  const now = new Date();
  const enrollment = await Enrollment.exists({
    student: userId,
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  });
  if (!enrollment) {
    throw new AppError('Your course plan has expired or is not active', STATUS_CODES.FORBIDDEN);
  }
}

async function requestStudentOtp({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await authRepository.findUserByEmailWithSecrets(normalizedEmail);
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', STATUS_CODES.UNAUTHORIZED);
  }
  if (user.role !== ROLES.STUDENT || !user.isActive) {
    throw new AppError('Student account is not active', STATUS_CODES.FORBIDDEN);
  }
  await requireActiveStudentEnrollment(user._id);
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await LoginOtp.findOneAndUpdate(
    { user: user._id },
    {
      codeHash: otpHash(user._id, code),
      expiresAt,
      attempts: 0,
      requestedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );
  const delivery = await sendEmail({
    to: user.email,
    subject: 'Your Lokaraja Career Academy login OTP',
    text: `Your login OTP is ${code}. It expires in 10 minutes. Do not share it with anyone.`,
    html: `<p>Your Lokaraja Career Academy login OTP is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. Do not share it with anyone.</p>`,
  });
  if (delivery?.skipped) {
    await LoginOtp.deleteOne({ user: user._id });
    throw new AppError('Email OTP delivery is not configured', STATUS_CODES.SERVICE_UNAVAILABLE);
  }
  return { email: user.email, expiresAt };
}

async function verifyStudentOtp({ email, otp }) {
  const user = await authRepository.findUserByEmailWithSecrets(String(email).trim().toLowerCase());
  if (!user || user.role !== ROLES.STUDENT || !user.isActive) {
    throw new AppError('Invalid or expired OTP', STATUS_CODES.UNAUTHORIZED);
  }
  const record = await LoginOtp.findOne({ user: user._id }).select('+codeHash');
  if (!record || record.expiresAt < new Date() || record.attempts >= 5) {
    if (record) await LoginOtp.deleteOne({ _id: record._id });
    throw new AppError('Invalid or expired OTP', STATUS_CODES.UNAUTHORIZED);
  }
  const supplied = Buffer.from(otpHash(user._id, String(otp).trim()));
  const expected = Buffer.from(record.codeHash);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    record.attempts += 1;
    await record.save();
    throw new AppError('Invalid or expired OTP', STATUS_CODES.UNAUTHORIZED);
  }
  await requireActiveStudentEnrollment(user._id);
  await LoginOtp.deleteOne({ _id: record._id });
  user.authVersion = Number(user.authVersion || 0) + 1;
  const tokens = issueTokens(user);
  user.refreshTokens = [tokens.refreshToken];
  user.lastLoginAt = new Date();
  await user.save();
  return { user, tokens };
}

async function requestStudentPasswordReset({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = await authRepository.findUserByEmailWithSecrets(normalizedEmail);
  if (!user || !user.isActive) {
    return { eligible: false, message: 'If the email address is valid, a temporary password will be sent.' };
  }
  const hasPurchasedCourse = user.role !== ROLES.STUDENT || await Enrollment.exists({ student: user._id });
  if (!hasPurchasedCourse) {
    return { eligible: false, message: 'You are not a registered student. Please purchase a course first.' };
  }

  const cooldownMs = 12 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cooldownMs);
  const cooldownMessage = 'A temporary password can be requested only once every 12 hours. Please try again after the 12-hour cooldown.';
  if (user.passwordResetRequestedAt && user.passwordResetRequestedAt > cutoff) {
    return { eligible: false, message: cooldownMessage, cooldownUntil: new Date(user.passwordResetRequestedAt.getTime() + cooldownMs) };
  }
  // Atomically claim the reset window. This protects against two browser/app
  // taps racing and sending different temporary passwords to the same email.
  const requestedAt = new Date();
  user = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { passwordResetRequestedAt: { $exists: false } },
        { passwordResetRequestedAt: null },
        { passwordResetRequestedAt: { $lte: cutoff } },
      ],
    },
    { $set: { passwordResetRequestedAt: requestedAt } },
    { new: true }
  ).select('+password +authVersion +refreshTokens +passwordResetRequestedAt');
  if (!user) {
    return { eligible: false, message: cooldownMessage, cooldownUntil: new Date(Date.now() + cooldownMs) };
  }

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  user.password = await hashPassword(temporaryPassword);
  user.mustChangePassword = true;
  user.authVersion = Number(user.authVersion || 0) + 1;
  user.refreshTokens = [];
  await user.save();

  try {
    const delivery = await sendEmail({
      // Staff recovery is centrally controlled: Admin and Super Admin
      // temporary passwords go only to the academy recovery mailbox.
      to: [ROLES.ADMIN, ROLES.SUPERADMIN].includes(user.role) ? env.superadminRecoveryEmail : user.email,
      subject: 'Your Lokaraja Career Academy temporary password',
      text: `Your new temporary password is ${temporaryPassword}. Sign in, then change it immediately.`,
      html: `<p>Your new temporary password is:</p><p style="font-size:20px;font-weight:700">${temporaryPassword}</p><p>Sign in, then change it immediately.</p>`,
    });
    if (delivery?.skipped) throw new Error(delivery.reason || 'Email delivery is not configured');
  } catch {
    throw new AppError('Password was reset, but the email could not be sent. Please contact the academy.', STATUS_CODES.SERVICE_UNAVAILABLE);
  }
  return { eligible: true, message: 'A new temporary password has been sent securely. Password reset is available again after 12 hours.', cooldownUntil: new Date(requestedAt.getTime() + cooldownMs) };
}

async function refresh(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  const user = await authRepository.findUserByIdWithSecrets(decoded.sub);
  if (
    !user ||
    !user.refreshTokens.includes(refreshToken) ||
    Number(decoded.sv ?? -1) !== Number(user.authVersion || 0)
  ) {
    throw new AppError('Invalid refresh token', STATUS_CODES.UNAUTHORIZED);
  }
  if (user.role === ROLES.STUDENT) await requireActiveStudentEnrollment(user._id);
  const tokens = issueTokens(user);
  user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
  user.refreshTokens.push(tokens.refreshToken);
  await user.save();
  return { user, tokens };
}

async function logout(userId, refreshToken) {
  const user = await authRepository.findUserByIdWithSecrets(userId);
  if (user) {
    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
    await user.save();
  }
}

module.exports = {
  register,
  login,
  requestStudentOtp,
  verifyStudentOtp,
  requestStudentPasswordReset,
  refresh,
  logout,
  _internals: { otpHash },
};
