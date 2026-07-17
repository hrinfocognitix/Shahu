const twilio = require('twilio');
const env = require('../config/env');

async function sendSms({ to, body }) {
  if (!env.twilio.accountSid || !env.twilio.authToken || !env.twilio.from) {
    return { skipped: true, reason: 'Twilio is not configured' };
  }
  const client = twilio(env.twilio.accountSid, env.twilio.authToken);
  return client.messages.create({ from: env.twilio.from, to, body });
}

module.exports = { sendSms };
