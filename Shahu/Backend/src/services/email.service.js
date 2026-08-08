const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    // A blocked SMTP connection must fail before the mobile request timeout.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    logger.error('Email delivery is not configured', {
      smtpHostConfigured: Boolean(env.smtp.host),
      smtpUserConfigured: Boolean(env.smtp.user),
      smtpPasswordConfigured: Boolean(env.smtp.pass),
    });
    return { skipped: true, reason: 'SMTP is not configured' };
  }
  const recipientDomain = String(to || '').split('@')[1] || 'unknown';
  logger.info('Email delivery started', { recipientDomain, subject, smtpHost: env.smtp.host });
  try {
    const result = await createTransporter().sendMail({
      from: env.smtp.from,
      to,
      subject,
      html,
      text,
      attachments,
    });
    logger.info('Email delivery completed', { recipientDomain, subject, messageId: result.messageId });
    return result;
  } catch (error) {
    logger.error('Email delivery failed', {
      recipientDomain,
      subject,
      smtpHost: env.smtp.host,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });
    throw new AppError('Unable to send the OTP email right now. Please wait a moment and try again.', STATUS_CODES.SERVICE_UNAVAILABLE);
  }
}

module.exports = { sendEmail };
