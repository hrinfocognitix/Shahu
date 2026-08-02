const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const { STATUS_CODES } = require('../constants/statusCodes');
const { MESSAGES } = require('../constants/messages');
const emailOtpService = require('../services/emailOtp.service');

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  return apiResponse.success(res, {
    statusCode: STATUS_CODES.CREATED,
    message: MESSAGES.REGISTER_SUCCESS,
    data,
  });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  return apiResponse.success(res, { message: MESSAGES.LOGIN_SUCCESS, data });
});

const requestStudentOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestStudentOtp(req.body);
  return apiResponse.success(res, { message: 'OTP sent to the registered email', data });
});

const verifyStudentOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyStudentOtp(req.body);
  return apiResponse.success(res, { message: MESSAGES.LOGIN_SUCCESS, data });
});

const sendEmailOtp = asyncHandler(async (req, res) => {
  await emailOtpService.requestEmailOtp(req.body.email);
  // Always generic: callers cannot learn whether an account exists.
  return apiResponse.success(res, { message: 'If the email address is valid, a verification code has been sent.' });
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  await emailOtpService.verifyEmailOtp(req.body.email, req.body.otp);
  return apiResponse.success(res, { message: 'Email verified successfully.' });
});

const requestStudentPasswordReset = asyncHandler(async (req, res) => {
  const data = await authService.requestStudentPasswordReset(req.body);
  return apiResponse.success(res, {
    message: data.message,
    data,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken);
  return apiResponse.success(res, { message: 'Token refreshed', data });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req.body.refreshToken);
  return apiResponse.success(res, { message: 'Logged out successfully' });
});

module.exports = { register, login, requestStudentOtp, verifyStudentOtp, requestStudentPasswordReset, sendEmailOtp, verifyEmailOtp, refresh, logout };
