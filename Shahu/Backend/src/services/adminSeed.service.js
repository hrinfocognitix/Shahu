const User = require('../models/User');
const { hashPassword } = require('../helpers/bcrypt.helper');
const { ROLES } = require('../constants/roles');

async function ensureDefaultAdmin() {
  // The academy Super Admin signs in with the .tech address.  Keep the
  // historical .com account aligned too, so an old saved credential cannot
  // accidentally receive a lower-privilege admin role.
  const superadminEmails = ['superadmin@cognitix.tech', 'superadmin@cognitix.com'];
  const adminEmail = 'admin@cognitix.com';
  const defaultPassword = '12345678';
  const superadminPassword = await hashPassword(defaultPassword);

  await Promise.all(superadminEmails.map((email) => User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: 'Cognitix Super Admin',
        password: superadminPassword,
        initialPassword: defaultPassword,
        role: ROLES.SUPERADMIN,
        isActive: true,
        isDeleted: false,
        mustChangePassword: false
      }
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true
    }
  )));

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
