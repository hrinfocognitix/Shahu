const User = require('../models/User');
const { hashPassword } = require('../helpers/bcrypt.helper');
const { ROLES } = require('../constants/roles');

async function ensureDefaultAdmin() {
  const superadminEmail = 'superadmin@cognitix.com';
  const adminEmail = 'admin@cognitix.com';
  const defaultPassword = '12345678';

  await User.findOneAndUpdate(
    { email: superadminEmail },
    {
      $set: {
        name: 'Cognitix Super Admin',
        password: await hashPassword(defaultPassword),
        initialPassword: defaultPassword,
        role: ROLES.SUPERADMIN,
        isActive: true,
        isDeleted: false,
        mustChangePassword: false
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

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
