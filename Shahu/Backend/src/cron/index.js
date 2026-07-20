const cron = require('node-cron');
const { runAndLog } = require('../services/enrollmentReminder.service');

function startCronJobs() {
  cron.schedule('0 7 * * *', runAndLog, { timezone: 'Asia/Kolkata' });
  runAndLog();
}

module.exports = startCronJobs;
