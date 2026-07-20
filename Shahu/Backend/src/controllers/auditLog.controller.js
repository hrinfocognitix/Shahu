const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../helpers/pagination.helper');
const mongoose = require('mongoose');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = {};
  if (req.query.module) filter.module = String(req.query.module);
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.role) filter.role = String(req.query.role);
  if (req.query.user) {
    if (!mongoose.isValidObjectId(req.query.user)) throw new AppError('User filter is invalid', STATUS_CODES.BAD_REQUEST);
    filter.user = req.query.user;
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) {
      const start = new Date(req.query.from);
      if (Number.isNaN(start.getTime())) throw new AppError('From date is invalid', STATUS_CODES.BAD_REQUEST);
      filter.createdAt.$gte = start;
    }
    if (req.query.to) {
      const end = new Date(req.query.to);
      if (Number.isNaN(end.getTime())) throw new AppError('To date is invalid', STATUS_CODES.BAD_REQUEST);
      end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
    if (filter.createdAt.$gte && filter.createdAt.$lte < filter.createdAt.$gte) {
      throw new AppError('To date must be on or after from date', STATUS_CODES.BAD_REQUEST);
    }
  }
  if (req.query.search) {
    const search = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ action: search }, { module: search }, { reason: search }, { role: search }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    AuditLog.countDocuments(filter),
  ]);
  return apiResponse.success(res, {
    message: 'Audit logs fetched',
    data: items,
    meta: buildPaginationMeta({ ...pagination, total }),
  });
});

module.exports = { list };
