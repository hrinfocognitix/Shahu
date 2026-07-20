const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../constants/roles');
const { STATUS_CODES } = require('../constants/statusCodes');
const { hashPassword } = require('../helpers/bcrypt.helper');
const { getPagination, buildPaginationMeta } = require('../helpers/pagination.helper');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { role: ROLES.ADMIN, isDeleted: { $ne: true } };
  if (req.query.search) {
    const search = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: search }, { email: search }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    User.countDocuments(filter),
  ]);
  return apiResponse.success(res, { message: 'Admins fetched', data: items, meta: buildPaginationMeta({ ...pagination, total }) });
});

const create = asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLowerCase();
  if (await User.exists({ email })) throw new AppError('An account with this email already exists', STATUS_CODES.CONFLICT);
  const temporaryPassword = `Adm-${crypto.randomBytes(9).toString('base64url')}`;
  const admin = await User.create({
    name: req.body.name, email, password: await hashPassword(temporaryPassword),
    role: ROLES.ADMIN, mustChangePassword: true, createdBy: req.user._id, updatedBy: req.user._id,
  });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'admin_created', module: 'admins',
    recordId: admin._id, newValue: { name: admin.name, email: admin.email, isActive: true }, ipAddress: req.ip,
  });
  return apiResponse.success(res, {
    statusCode: STATUS_CODES.CREATED, message: 'Admin created',
    data: { admin, temporaryPassword },
  });
});

const update = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.id, role: ROLES.ADMIN, isDeleted: { $ne: true } })
    .select('+authVersion +refreshTokens');
  if (!admin) throw new AppError('Admin not found', STATUS_CODES.NOT_FOUND);
  if (String(admin._id) === String(req.user._id) && req.body.isActive === false) {
    throw new AppError('You cannot deactivate your own account', STATUS_CODES.CONFLICT);
  }
  const previousValue = { name: admin.name, isActive: admin.isActive };
  if (req.body.name !== undefined) admin.name = req.body.name;
  if (req.body.isActive !== undefined && req.body.isActive !== admin.isActive) {
    admin.isActive = req.body.isActive;
    if (!admin.isActive) {
      admin.authVersion = Number(admin.authVersion || 0) + 1;
      admin.refreshTokens = [];
    }
  }
  admin.updatedBy = req.user._id;
  await admin.save();
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'admin_updated', module: 'admins',
    recordId: admin._id, previousValue, newValue: { name: admin.name, isActive: admin.isActive }, ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Admin updated', data: admin });
});

module.exports = { list, create, update };
