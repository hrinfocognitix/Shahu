const admin = require('firebase-admin');
const env = require('./env');
const logger = require('./logger');

function getFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  if (!env.firebase.projectId || !env.firebase.clientEmail || !env.firebase.privateKey) {
    logger.warn('Firebase Admin is not configured; notification sending will be skipped.');
    return null;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey
    })
  });

  return admin;
}

module.exports = getFirebaseAdmin;
