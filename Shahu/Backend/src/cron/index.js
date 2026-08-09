const cron = require('node-cron');
const { runAndLog } = require('../services/enrollmentReminder.service');
const { expireRazorpayQrPayments } = require('../services/paymentIntent.service');

function startCronJobs() {
  cron.schedule('0 7 * * *', runAndLog, { timezone: 'Asia/Kolkata' });
  cron.schedule('* * * * *', () => expireRazorpayQrPayments().catch(() => undefined), { timezone: 'Asia/Kolkata' });
  runAndLog();
}

module.exports = startCronJobs;
