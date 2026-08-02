const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const AppInstallation = require('../models/AppInstallation');

const clean = (value, max = 512) => String(value || '').trim().slice(0, max);

const register = asyncHandler(async (req, res) => {
  const uuid = clean(req.body?.uuid, 128);
  if (!uuid) throw new AppError('A device identifier is required', STATUS_CODES.BAD_REQUEST);

  const update = {
    platform: clean(req.body?.platform, 32) || 'android',
    appVersion: clean(req.body?.appVersion, 64),
    notificationsEnabled: Boolean(req.body?.notificationsEnabled),
    lastSeenAt: new Date(),
  };
  const fcmToken = clean(req.body?.fcmToken, 4096);
  if (fcmToken) update.fcmToken = fcmToken;

  await AppInstallation.findOneAndUpdate(
    { uuid },
    { $set: update, $setOnInsert: { uuid, firstSeenAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return apiResponse.success(res, { statusCode: 201, message: 'App installation registered' });
});

const linkStudent = asyncHandler(async (req, res) => {
  const uuid = clean(req.params.uuid, 128);
  if (!uuid) throw new AppError('A device identifier is required', STATUS_CODES.BAD_REQUEST);
  await AppInstallation.findOneAndUpdate(
    { uuid },
    { $set: { student: req.user._id, lastSeenAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return apiResponse.success(res, { message: 'Installation linked to student' });
});

module.exports = { register, linkStudent };
