const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const authRepository = require('../repositories/auth.repository');
const { comparePassword, hashPassword } = require('../helpers/bcrypt.helper');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require('../helpers/jwt.helper');

function tokenPayload(user) {
  return {
    sub: user._id.toString(),
    role: user.role,
    email: user.email
  };
}

function issueTokens(user) {
  const payload = tokenPayload(user);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
}

async function register(payload) {
  const existing = await authRepository.findUserByEmailWithSecrets(payload.email);
  if (existing) {
    throw new AppError('Email already registered', STATUS_CODES.CONFLICT);
  }

  const user = await authRepository.createUser({
    ...payload,
    password: await hashPassword(payload.password)
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

  const tokens = issueTokens(user);
  user.refreshTokens.push(tokens.refreshToken);
  user.lastLoginAt = new Date();
  await user.save();
  return { user, tokens };
}

async function refresh(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  const user = await authRepository.findUserByIdWithSecrets(decoded.sub);
  if (!user || !user.refreshTokens.includes(refreshToken)) {
    throw new AppError('Invalid refresh token', STATUS_CODES.UNAUTHORIZED);
  }
  const tokens = issueTokens(user);
  user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
  user.refreshTokens.push(tokens.refreshToken);
  await user.save();
  return { user, tokens };
}

async function logout(userId, refreshToken) {
  const user = await authRepository.findUserByIdWithSecrets(userId);
  if (user) {
    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    await user.save();
  }
}

module.exports = { register, login, refresh, logout };
