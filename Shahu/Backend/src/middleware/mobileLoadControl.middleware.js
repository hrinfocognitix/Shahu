const AcademyRecord = require('../models/AcademyRecord');
const AppInstallation = require('../models/AppInstallation');

const SETTING_TITLE = 'Mobile API load control';
let cachedSetting = null;
let cachedAt = 0;

async function currentSetting() {
  if (Date.now() - cachedAt < 30000) return cachedSetting;
  const record = await AcademyRecord.findOne({ module: 'setting', title: SETTING_TITLE, isDeleted: { $ne: true } }).lean();
  cachedSetting = record?.payload || null;
  cachedAt = Date.now();
  return cachedSetting;
}

async function mobileLoadControl(req, res, next) {
  if (String(req.header('x-client-platform') || '').toLowerCase() !== 'android' || !req.user?._id) return next();
  try {
    const now = new Date();
    await AppInstallation.updateMany({ student: req.user._id }, { $set: { lastSeenAt: now } });
    const setting = await currentSetting();
    const maxActiveUsers = Number(setting?.maxActiveUsers || 0);
    const delaySeconds = Number(setting?.delaySeconds || 0);
    if (!maxActiveUsers || !delaySeconds) return next();
    const activeSince = new Date(now.getTime() - 10 * 60 * 1000);
    const activeUsers = await AppInstallation.distinct('student', { student: { $ne: null }, lastSeenAt: { $gte: activeSince } });
    if (activeUsers.length <= maxActiveUsers) return next();
    return setTimeout(next, Math.min(delaySeconds, 20) * 1000);
  } catch {
    return next();
  }
}

module.exports = { mobileLoadControl, SETTING_TITLE };
