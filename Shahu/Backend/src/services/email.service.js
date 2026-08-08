const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 15_000;

const toBrevoAttachments = (attachments = []) => attachments.map((attachment) => ({
  name: attachment.filename || attachment.name || 'attachment',
  content: Buffer.isBuffer(attachment.content)
    ? attachment.content.toString('base64')
    : String(attachment.content || ''),
}));

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!env.email.brevoApiKey || !env.email.from) {
    logger.error('Brevo email delivery is not configured', {
      brevoApiKeyConfigured: Boolean(env.email.brevoApiKey),
      emailFromConfigured: Boolean(env.email.from),
    });
    return { skipped: true, reason: 'Brevo email delivery is not configured' };
  }

  const recipientDomain = String(to || '').split('@')[1] || 'unknown';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  logger.info('Brevo email delivery started', { recipientDomain, subject });

  try {
    const response = await fetch(BREVO_EMAIL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': env.email.brevoApiKey,
      },
      body: JSON.stringify({
        sender: { email: env.email.from, name: env.email.fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
        ...(attachments?.length ? { attachment: toBrevoAttachments(attachments) } : {}),
      }),
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Brevo returned HTTP ${response.status}`);
      error.status = response.status;
      error.code = responseBody.code;
      throw error;
    }
    logger.info('Brevo email delivery completed', { recipientDomain, subject, messageId: responseBody.messageId });
    return { messageId: responseBody.messageId };
  } catch (error) {
    logger.error('Brevo email delivery failed', {
      recipientDomain,
      subject,
      status: error.status,
      code: error.code,
      timedOut: error.name === 'AbortError',
      message: error.message,
    });
    throw new AppError('Unable to send the email right now. Please wait a moment and try again.', STATUS_CODES.SERVICE_UNAVAILABLE);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendEmail };
