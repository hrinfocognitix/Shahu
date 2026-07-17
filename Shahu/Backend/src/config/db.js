const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

async function connectDB(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      mongoose.set('strictQuery', true);
      await mongoose.connect(env.mongoUri, {
        autoIndex: env.nodeEnv !== 'production'
      });
      logger.info('MongoDB connected');
      return mongoose.connection;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed`, error);
      if (attempt === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

module.exports = connectDB;
