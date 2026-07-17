const User = require('../models/User');
const { hashPassword } = require('../helpers/bcrypt.helper');
const { ROLES } = require('../constants/roles');

async function ensureDefaultAdmin() {
  const superadminEmail = 'superadmin@cognitix.com';
  const adminEmail = 'admin@cognitix.com';
  const defaultPassword = '12345678';

  const superadmin = await User.findOne({ email: superadminEmail }).select('_id');
  if (!superadmin) {
    await User.create({
      name: 'Cognitix Super Admin',
      email: superadminEmail,
      password: await hashPassword(defaultPassword),
      initialPassword: defaultPassword,
      role: ROLES.SUPERADMIN,
      isActive: true
    });
  }

  const admin = await User.findOne({ email: adminEmail }).select('_id +initialPassword');
  if (admin) {
    if (!admin.initialPassword) {
      admin.initialPassword = defaultPassword;
      await admin.save();
    }
    return admin;
  }

  return User.create({
    name: 'Cognitix Administrator',
    email: adminEmail,
    password: await hashPassword(defaultPassword),
    initialPassword: defaultPassword,
    role: ROLES.ADMIN,
    isActive: true
  });
}

module.exports = { ensureDefaultAdmin };
