const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const logger = require('./config/logger');
const startCronJobs = require('./cron');
const initSocket = require('./sockets');
const { ensureDefaultAdmin } = require('./services/adminSeed.service');
const { allowDuplicateSubjectNames } = require('./services/subjectIndex.service');

async function bootstrap() {
  await connectDB();
  await ensureDefaultAdmin();
  await allowDuplicateSubjectNames();

  const server = http.createServer(app);
  initSocket(server);
  startCronJobs();

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${env.port} is already in use. Set PORT in .env.local to an available port.`);
    } else {
      logger.error('HTTP server failed', error);
    }
    process.exit(1);
  });

  server.listen(env.port, () => {
    logger.info(`API listening on port ${env.port}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received; shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

bootstrap().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
