const getFirebaseAdmin = require('../config/firebase');
const logger = require('../config/logger');

async function sendPush({ token, title, body, data = {} }) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('Skipping push notification because Firebase is not configured');
    return null;
  }
  return admin.messaging().send({ token, notification: { title, body }, data });
}

module.exports = { sendPush };
