const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const env = require('./env');
const logger = require('./logger');

function configuredCredential() {
  if (env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey) {
    return {
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    };
  }

  const filePath = env.firebase.serviceAccountPath || path.join(__dirname, 'firebase-service-account.json');
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    logger.error(`Unable to read Firebase service account: ${error.message}`);
  }
  return null;
}

function getFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const credential = configuredCredential();
  if (!credential) {
    logger.warn('Firebase Admin is not configured; notification sending will be skipped.');
    return null;
  }

  admin.initializeApp({
    credential: admin.credential.cert(credential)
  });

  return admin;
}

module.exports = getFirebaseAdmin;
