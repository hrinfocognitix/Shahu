const SplashScreen = require('../models/SplashScreen');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const active = asyncHandler(async (req, res) => {
  const now = new Date();
  const splashScreen =
    (await SplashScreen.findOne({ isEnabled: true, startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ startsAt: -1 })) ||
    (await SplashScreen.findOne({ isEnabled: true }).sort({ createdAt: -1 }));
  return apiResponse.success(res, { message: 'Active splash screen fetched', data: splashScreen });
});
const list = asyncHandler(async (req, res) => apiResponse.success(res, { message: 'Splash screens fetched', data: await SplashScreen.find().sort({ createdAt: -1 }) }));
const create = asyncHandler(async (req, res) => {
  if (new Date(req.body.endsAt) <= new Date(req.body.startsAt)) throw new AppError('End time must be after start time', STATUS_CODES.BAD_REQUEST);
  const item = await SplashScreen.create({
    ...req.body,
    mediaType: req.body.mediaType || (req.body.videoUrl ? 'video' : 'image'),
    createdBy: req.user._id
  });
  return apiResponse.success(res, { statusCode: STATUS_CODES.CREATED, message: 'Splash screen created', data: item });
});
const update = asyncHandler(async (req, res) => {
  const item = await SplashScreen.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) throw new AppError('Splash screen not found', STATUS_CODES.NOT_FOUND);
  return apiResponse.success(res, { message: 'Splash screen updated', data: item });
});
const remove = asyncHandler(async (req, res) => {
  const item = await SplashScreen.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError('Splash screen not found', STATUS_CODES.NOT_FOUND);
  return apiResponse.success(res, { message: 'Splash screen deleted' });
});
module.exports = { active, list, create, update, remove };
