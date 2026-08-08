const getFirebaseAdmin = require('../config/firebase');
const logger = require('../config/logger');
const AppInstallation = require('../models/AppInstallation');

async function sendPush({ token, title, body, data = {} }) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('Skipping push notification because Firebase is not configured');
    return null;
  }
  return admin.messaging().send({ token, notification: { title, body }, data });
}

async function sendNewCoursePush(course) {
  return sendNotificationPush({
    title: 'New course available',
    body: `${course.name} is now available.`,
    data: {
      type: 'new_course',
      courseId: String(course._id),
      courseName: String(course.name || ''),
      deepLink: `shahu://course/${course._id}`,
    },
  });
}

async function sendNotificationPush({ title, body, student, students, data = {} }) {
  const filter = { notificationsEnabled: true, fcmToken: { $type: 'string', $ne: '' } };
  if (student) filter.student = student;
  if (Array.isArray(students)) filter.student = { $in: students };
  const tokens = await AppInstallation.find(filter).distinct('fcmToken');
  if (!tokens.length) {
    logger.warn('Push notification skipped because no enabled device tokens matched', { student: student ? String(student) : undefined, students: Array.isArray(students) ? students.length : undefined });
    return { sent: 0 };
  }

  const admin = getFirebaseAdmin();
  if (!admin) return { sent: 0, skipped: true };
  const payload = {
    notification: { title: String(title || 'Academy update'), body: String(body || '') },
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
    android: { priority: 'high' },
  };
  let sent = 0;
  const failures = [];
  for (let start = 0; start < tokens.length; start += 500) {
    const result = await admin.messaging().sendEachForMulticast({ ...payload, tokens: tokens.slice(start, start + 500) });
    sent += result.successCount;
    result.responses.forEach((response, index) => {
      if (!response.success) failures.push({ code: response.error?.code, tokenIndex: start + index });
    });
  }
  logger.info('Push notification delivery finished', { sent, total: tokens.length, failed: failures.length, failures: failures.slice(0, 10) });
  return { sent, total: tokens.length, failed: failures.length };
}

module.exports = { sendPush, sendNewCoursePush, sendNotificationPush };
