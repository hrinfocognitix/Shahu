const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const AppInstallation = require('../models/AppInstallation');
const logger = require('../config/logger');
const crypto = require('crypto');
const { sendNotificationPush } = require('../services/notification.service');

const clean = (value, max = 512) => String(value || '').trim().slice(0, max);
const fingerprint = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);

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

  const installation = await AppInstallation.findOneAndUpdate(
    { uuid },
    { $set: update, $setOnInsert: { uuid, firstSeenAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  logger.info('Android notification installation registered', {
    requestId: req.requestId,
    installationRef: fingerprint(uuid),
    fcmTokenRef: fcmToken ? fingerprint(fcmToken) : undefined,
    notificationsEnabled: update.notificationsEnabled,
    platform: update.platform,
    appVersion: update.appVersion,
    linkedStudent: Boolean(installation.student),
  });
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
  logger.info('Android notification installation linked to student', {
    requestId: req.requestId,
    installationRef: fingerprint(uuid),
    studentId: String(req.user._id),
  });
  // The mobile client sets welcome=true only for an interactive login, not a
  // background session refresh. Send after linking so the new device token is
  // included in the recipient lookup.
  if (req.body?.welcome === true && req.user.role === 'student') {
    const studentName = String(req.user.name || '').trim();
    void sendNotificationPush({
      title: 'Welcome to Shahu Academy',
      body: studentName ? `Welcome back, ${studentName}! Your learning dashboard is ready.` : 'Welcome back! Your learning dashboard is ready.',
      student: req.user._id,
      data: { type: 'login_welcome' },
    }).then((result) => {
      logger.info('Student login welcome notification queued', { requestId: req.requestId, studentId: String(req.user._id), ...result });
    }).catch((error) => {
      logger.error('Student login welcome notification failed', { requestId: req.requestId, studentId: String(req.user._id), error: error.message });
    });
  }
  return apiResponse.success(res, { message: 'Installation linked to student' });
});

module.exports = { register, linkStudent };
