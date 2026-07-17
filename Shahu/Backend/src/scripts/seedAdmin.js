const mongoose = require('mongoose');
const env = require('../config/env');
const { ensureDefaultAdmin } = require('../services/adminSeed.service');

async function seedAdmin() {
  await mongoose.connect(env.mongoUri);
  await ensureDefaultAdmin();
  await mongoose.disconnect();
  process.stdout.write('Default admin seeded.\n');
}

seedAdmin().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
