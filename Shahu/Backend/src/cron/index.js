const cron = require('node-cron');
const { runAndLog } = require('../services/enrollmentReminder.service');
const { expireRazorpayQrPayments } = require('../services/paymentIntent.service');
const { sendDueLectureNotifications, sendLectureFiveMinuteReminders } = require('../services/scheduledLecture.service');

function startCronJobs() {
  cron.schedule('0 7 * * *', runAndLog, { timezone: 'Asia/Kolkata' });
  cron.schedule('* * * * *', () => expireRazorpayQrPayments().catch(() => undefined), { timezone: 'Asia/Kolkata' });
  cron.schedule('* * * * *', () => sendDueLectureNotifications().catch(() => undefined), { timezone: 'Asia/Kolkata' });
  cron.schedule('* * * * *', () => sendLectureFiveMinuteReminders().catch(() => undefined), { timezone: 'Asia/Kolkata' });
  runAndLog();
  void sendDueLectureNotifications().catch(() => undefined);
  void sendLectureFiveMinuteReminders().catch(() => undefined);
}

module.exports = startCronJobs;
