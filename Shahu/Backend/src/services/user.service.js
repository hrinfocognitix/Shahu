const userRepository = require('../repositories/user.repository');
const { getPagination, buildPaginationMeta } = require('../helpers/pagination.helper');
const { comparePassword, hashPassword } = require('../helpers/bcrypt.helper');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');

function generateInitialPassword() {
  return `Tch-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function listUsers(query, currentUser) {
  const pagination = getPagination(query);
  const filter = query.search
    ? {
        $or: [
          { name: new RegExp(query.search, 'i') },
          { email: new RegExp(query.search, 'i') }
        ]
      }
    : {};
  if (query.role) filter.role = query.role;
  if (query.deleted === 'true') filter.isDeleted = true;
  else if (query.deleted !== 'all') filter.isDeleted = { $ne: true };
  const list = currentUser?.role === ROLES.SUPERADMIN ? userRepository.listWithInitialPasswords : userRepository.list;
  const [items, total] = await Promise.all([
    list({ filter, skip: pagination.skip, limit: pagination.limit }),
    userRepository.count(filter)
  ]);
  return {
    items,
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

const getUserById = id => userRepository.findById(id);
const updateUser = (id, payload) => userRepository.updateById(id, payload);

async function updateOwnPassword(userId, { currentPassword, newPassword }) {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user || !(await comparePassword(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect', STATUS_CODES.BAD_REQUEST);
  }
  user.password = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  return user;
}

async function createUser(payload) {
  const existing = await userRepository.findByEmail(payload.email);
  if (existing) throw new AppError('Email already registered', STATUS_CODES.CONFLICT);
  const initialPassword = payload.role === ROLES.TEACHER ? generateInitialPassword() : payload.password;
  return userRepository.create({
    ...payload,
    password: await hashPassword(initialPassword),
    initialPassword,
    mustChangePassword: payload.role === ROLES.TEACHER
  });
}

async function softDeleteUser(id, userId) {
  const user = await userRepository.updateById(id, { isDeleted: true, deletedAt: new Date(), deletedBy: userId });
  if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
  return user;
}

async function restoreUser(id, userId) {
  const user = await userRepository.updateById(id, { isDeleted: false, restoredAt: new Date(), restoredBy: userId });
  if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
  return user;
}

async function permanentDeleteUser(id) {
  const user = await userRepository.deleteById(id);
  if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
}

module.exports = { listUsers, getUserById, updateUser, updateOwnPassword, createUser, softDeleteUser, restoreUser, permanentDeleteUser };
