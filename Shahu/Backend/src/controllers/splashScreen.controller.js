const SplashScreen = require('../models/SplashScreen');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const fs = require('fs/promises');

const discardUpload = (req) => req.file?.path ? fs.unlink(req.file.path).catch(() => undefined) : Promise.resolve();

const active = asyncHandler(async (req, res) => {
  const now = new Date();
  const splashScreen = await SplashScreen.findOne({
    isEnabled: true,
    isDeleted: { $ne: true },
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).sort({ startsAt: -1 });
  return apiResponse.success(res, { message: 'Active splash screen fetched', data: splashScreen });
});
const list = asyncHandler(async (req, res) => apiResponse.success(res, { message: 'Splash screens fetched', data: await SplashScreen.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }) }));
const create = asyncHandler(async (req, res) => {
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    await discardUpload(req);
    throw new AppError('End time must be after a valid start time', STATUS_CODES.BAD_REQUEST);
  }
  const mediaType = req.body.mediaType || (req.body.videoUrl ? 'video' : 'image');
  if (!['image', 'video'].includes(mediaType)) {
    await discardUpload(req);
    throw new AppError('Media type must be image or video', STATUS_CODES.BAD_REQUEST);
  }
  if (req.file) {
    const matchesType = mediaType === 'video'
      ? req.file.mimetype.startsWith('video/')
      : req.file.mimetype.startsWith('image/');
    if (!matchesType) {
      await discardUpload(req);
      throw new AppError(`Select a valid ${mediaType} file`, STATUS_CODES.BAD_REQUEST);
    }
  }
  const uploadedUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
  const imageUrl = uploadedUrl || req.body.imageUrl;
  if (!imageUrl) throw new AppError('A splash image or video is required', STATUS_CODES.BAD_REQUEST);
  let item;
  try {
    item = await SplashScreen.create({
      ...req.body, startsAt, endsAt, imageUrl,
      videoUrl: mediaType === 'video' ? uploadedUrl || req.body.videoUrl || imageUrl : undefined,
      mediaType, createdBy: req.user._id
    });
  } catch (error) {
    await discardUpload(req);
    throw error;
  }
  return apiResponse.success(res, { statusCode: STATUS_CODES.CREATED, message: 'Splash screen created', data: item });
});
const update = asyncHandler(async (req, res) => {
  const item = await SplashScreen.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!item) throw new AppError('Splash screen not found', STATUS_CODES.NOT_FOUND);
  return apiResponse.success(res, { message: 'Splash screen updated', data: item });
});
const remove = asyncHandler(async (req, res) => {
  const item = await SplashScreen.findOneAndUpdate(
    { _id: req.params.id, isDeleted: { $ne: true } },
    { isDeleted: true, isEnabled: false, deletedAt: new Date(), deletedBy: req.user._id },
    { new: true }
  );
  if (!item) throw new AppError('Splash screen not found', STATUS_CODES.NOT_FOUND);
  return apiResponse.success(res, { message: 'Splash screen deleted' });
});
module.exports = { active, list, create, update, remove };
