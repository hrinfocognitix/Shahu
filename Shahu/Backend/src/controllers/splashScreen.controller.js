const SplashScreen = require('../models/SplashScreen');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { uploadBuffer, destroyAsset } = require('../services/cloudinary.service');
const { sendNotificationPush } = require('../services/notification.service');

const discardUpload = () => Promise.resolve();

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
  const upload = req.file ? await uploadBuffer(req.file, { folder: 'shahu-academy/splashes' }) : undefined;
  const uploadedUrl = upload?.secure_url;
  const imageUrl = uploadedUrl || req.body.imageUrl;
  if (!imageUrl) throw new AppError('A splash image or video is required', STATUS_CODES.BAD_REQUEST);
  let item;
  try {
    item = await SplashScreen.create({
      ...req.body, startsAt, endsAt, imageUrl,
      videoUrl: mediaType === 'video' ? uploadedUrl || req.body.videoUrl || imageUrl : undefined,
      mediaType, publicId: upload?.public_id, cloudinaryResourceType: upload?.resource_type, createdBy: req.user._id
    });
  } catch (error) {
    await destroyAsset(upload?.public_id, upload?.resource_type).catch(() => undefined);
    throw error;
  }
  // A festival splash and a manually uploaded splash use this same record.
  // Notify every opted-in device; a tap launches the app, which fetches the
  // active splash screen again and displays it when its schedule is active.
  void sendNotificationPush({
    title: item.title || 'Academy update',
    body: 'A new academy splash screen is available. Open the app to view it.',
    data: { type: 'splash_screen', splashId: item._id },
  }).catch(() => undefined);
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
  await destroyAsset(item.publicId, item.cloudinaryResourceType).catch(() => undefined);
  return apiResponse.success(res, { message: 'Splash screen deleted' });
});
const permanentlyRemove = asyncHandler(async (req, res) => {
  const item = await SplashScreen.findOneAndDelete({ _id: req.params.id });
  if (!item) throw new AppError('Splash screen not found', STATUS_CODES.NOT_FOUND);

  await destroyAsset(item.publicId, item.cloudinaryResourceType).catch(() => undefined);
  return apiResponse.success(res, { message: 'Splash screen permanently deleted' });
});
module.exports = { active, list, create, update, remove, permanentlyRemove };
