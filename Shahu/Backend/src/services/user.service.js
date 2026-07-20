const userRepository = require('../repositories/user.repository');
const { getPagination, buildPaginationMeta } = require('../helpers/pagination.helper');
const { comparePassword, hashPassword } = require('../helpers/bcrypt.helper');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');

function generateInitialPassword() {
  return `Tch-${Math.random().toString(36).slice(2, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
}

function mergeProfile(currentProfile, updates) {
  const previous = currentProfile?.toObject?.() || currentProfile || {};
  return { ...previous, ...(updates || {}) };
}

async function listUsers(query) {
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
  const [items, total] = await Promise.all([
    userRepository.list({ filter, skip: pagination.skip, limit: pagination.limit }),
    userRepository.count(filter)
  ]);
  return {
    items,
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

const getUserById = id => userRepository.findById(id);
async function updateUser(id, payload) {
  const current = await userRepository.findById(id);
  if (!current) return null;
  const previousProfile = current.profile?.toObject?.() || current.profile || {};
  if (payload.profile) payload.profile = mergeProfile(previousProfile, payload.profile);
  if (current.role === ROLES.TEACHER) {
    const normalizedMobile = String(payload.profile?.mobile || payload.profile?.phone || current.profile?.mobile || current.profile?.phone || '').replace(/\D/g, '').slice(-10);
    if (normalizedMobile && await userRepository.findTeacherByMobile(normalizedMobile, id)) throw new AppError('A teacher with this mobile number already exists.', STATUS_CODES.CONFLICT);
    const nextAssigned = payload.profile?.assignedSubjects;
    const assignmentChanged = Array.isArray(nextAssigned) && JSON.stringify((previousProfile.assignedSubjects || []).map(String).sort()) !== JSON.stringify(nextAssigned.map(String).sort());
    payload.profile = { ...previousProfile, ...(payload.profile || {}), phone: normalizedMobile, mobile: normalizedMobile };
    if (assignmentChanged) payload.profile.subjectAssignmentHistory = [...(previousProfile.subjectAssignmentHistory || []), { subjects: nextAssigned, changedAt: new Date(), changedBy: payload.updatedBy }];
  }
  return userRepository.updateById(id, { ...payload, updatedBy: payload.updatedBy });
}

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
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const normalizedMobile = String(payload.profile?.mobile || payload.profile?.phone || '').replace(/\D/g, '').slice(-10);
  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing) throw new AppError(payload.role === ROLES.TEACHER ? 'A teacher with this email address already exists.' : 'Email already registered', STATUS_CODES.CONFLICT);
  if (payload.role === ROLES.TEACHER && normalizedMobile) {
    const existingMobile = await userRepository.findTeacherByMobile(normalizedMobile);
    if (existingMobile) throw new AppError('A teacher with this mobile number already exists.', STATUS_CODES.CONFLICT);
  }
  const initialPassword = payload.role === ROLES.TEACHER ? generateInitialPassword() : payload.password;
  const user = await userRepository.create({
    ...payload,
    email: normalizedEmail,
    profile: { ...(payload.profile || {}), phone: normalizedMobile, mobile: normalizedMobile },
    password: await hashPassword(initialPassword),
    mustChangePassword: payload.role === ROLES.TEACHER
  });
  return {
    user,
    ...(payload.role === ROLES.TEACHER ? { temporaryPassword: initialPassword } : {}),
  };
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

module.exports = { listUsers, getUserById, updateUser, updateOwnPassword, createUser, softDeleteUser, restoreUser, permanentDeleteUser, _internals: { mergeProfile } };
