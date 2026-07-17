const cron = require('node-cron');
const logger = require('../config/logger');

function startCronJobs() {
  cron.schedule('0 * * * *', () => {
    logger.info('Hourly maintenance cron executed');
  });
}

module.exports = startCronJobs;
