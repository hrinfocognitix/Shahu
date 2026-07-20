const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const authRepository = require('../repositories/auth.repository');
const { comparePassword, hashPassword } = require('../helpers/bcrypt.helper');
const crypto = require('crypto');
const env = require('../config/env');
const { ROLES } = require('../constants/roles');
const LoginOtp = require('../models/LoginOtp');
const Enrollment = require('../models/Enrollment');
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

async function login({ email, password }) {
  const user = await authRepository.findUserByEmailWithSecrets(email);
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError('Invalid email or password', STATUS_CODES.UNAUTHORIZED);
  }
  if (!user.isActive) {
    throw new AppError('Account is disabled', STATUS_CODES.FORBIDDEN);
  }
  if (user.role === ROLES.STUDENT) {
    throw new AppError(
      'Student login requires the OTP sent to the registered email',
      STATUS_CODES.FORBIDDEN
    );
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
  refresh,
  logout,
  _internals: { otpHash },
};
