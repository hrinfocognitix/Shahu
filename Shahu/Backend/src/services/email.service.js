const nodemailer = require('nodemailer');
const env = require('../config/env');

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!env.smtp.host) {
    return { skipped: true, reason: 'SMTP is not configured' };
  }
  return createTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = { sendEmail };
