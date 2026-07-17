const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const { STATUS_CODES } = require('../constants/statusCodes');
const { MESSAGES } = require('../constants/messages');

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  return apiResponse.success(res, {
    statusCode: STATUS_CODES.CREATED,
    message: MESSAGES.REGISTER_SUCCESS,
    data
  });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  return apiResponse.success(res, { message: MESSAGES.LOGIN_SUCCESS, data });
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken);
  return apiResponse.success(res, { message: 'Token refreshed', data });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req.body.refreshToken);
  return apiResponse.success(res, { message: 'Logged out successfully' });
});

module.exports = { register, login, refresh, logout };
