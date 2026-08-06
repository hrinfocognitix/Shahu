const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const AuditLog = require('../models/AuditLog');

const listUsers = asyncHandler(async (req, res) => {
  const { items, meta } = await userService.listUsers(req.query, req.user);
  return apiResponse.success(res, { message: 'Users fetched', data: items, meta });
});

const getProfile = asyncHandler(async (req, res) =>
  apiResponse.success(res, { message: 'Profile fetched', data: req.user })
);

const updateOwnProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['mobile', 'phone', 'whatsapp', 'photo', 'address', 'city', 'state', 'pinCode', 'gender', 'dateOfBirth', 'age', 'height', 'weight', 'qualification', 'educationQualification', 'schoolCollege', 'currentClass', 'fatherName', 'motherName', 'biography'];
  if (Object.prototype.hasOwnProperty.call(req.body.profile || {}, 'dateOfBirth')) {
    const dateOfBirth = new Date(req.body.profile.dateOfBirth);
    const oldestAllowedBirthDate = new Date();
    oldestAllowedBirthDate.setHours(0, 0, 0, 0);
    oldestAllowedBirthDate.setFullYear(oldestAllowedBirthDate.getFullYear() - 14);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > oldestAllowedBirthDate) {
      throw new AppError('Student must be at least 14 years old. Future dates are not allowed.', STATUS_CODES.BAD_REQUEST);
    }
  }
  const profile = Object.fromEntries(allowedFields.filter((key) => Object.prototype.hasOwnProperty.call(req.body.profile || {}, key)).map((key) => [key, req.body.profile[key]]));
  const user = await userService.updateUser(req.user._id, { name: String(req.body.name || req.user.name).trim(), profile, updatedBy: req.user._id });
  return apiResponse.success(res, { message: 'Profile updated', data: user });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  if (!user) {
    throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
  }
  return apiResponse.success(res, { message: 'User fetched', data: user });
});

const updateUser = asyncHandler(async (req, res) => {
  const previous = await userService.getUserById(req.params.id);
  if (!previous) {
    throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
  }
  const user = await userService.updateUser(req.params.id, { ...req.body, updatedBy: req.user._id });
  if (!user) {
    throw new AppError('User not found', STATUS_CODES.NOT_FOUND);
  }
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: previous.role === 'student' ? 'student_profile_updated' : 'teacher_profile_updated',
    module: previous.role === 'student' ? 'students' : 'teachers',
    recordId: previous._id,
    previousValue: { name: previous.name, profile: previous.profile, isActive: previous.isActive },
    newValue: { name: user.name, profile: user.profile, isActive: user.isActive },
    ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'User updated', data: user });
});

const updateOwnPassword = asyncHandler(async (req, res) => {
  await userService.updateOwnPassword(req.user._id, req.body);
  return apiResponse.success(res, { message: 'Password updated' });
});

const createUser = asyncHandler(async (req, res) => {
  const result = await userService.createUser(req.body);
  return apiResponse.success(res, {
    statusCode: STATUS_CODES.CREATED,
    message: 'User created',
    data: req.body.role === 'teacher'
      ? { teacher: result.user, temporaryPassword: result.temporaryPassword }
      : result.user,
  });
});

const softDeleteUser = asyncHandler(async (req, res) => {
  const user = await userService.softDeleteUser(req.params.id, req.user._id);
  return apiResponse.success(res, { message: 'User deleted', data: user });
});

const restoreUser = asyncHandler(async (req, res) => {
  const user = await userService.restoreUser(req.params.id, req.user._id);
  return apiResponse.success(res, { message: 'User restored', data: user });
});

const permanentDeleteUser = asyncHandler(async (req, res) => {
  await userService.permanentDeleteUser(req.params.id);
  return apiResponse.success(res, { message: 'User permanently deleted' });
});

module.exports = { listUsers, getProfile, updateOwnProfile, getUser, updateUser, updateOwnPassword, createUser, softDeleteUser, restoreUser, permanentDeleteUser };
