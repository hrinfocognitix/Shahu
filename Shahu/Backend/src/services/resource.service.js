const { getPagination, buildPaginationMeta } = require('../helpers/pagination.helper');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

async function list(Model, query, populate = '', accessFilter = {}) {
  const pagination = getPagination(query);
  const filter = {};
  if (query.deleted === 'true') filter.isDeleted = true;
  else if (query.deleted !== 'all') filter.isDeleted = { $ne: true };
  if (query.status) filter.status = query.status;
  if (query.course) filter.course = query.course;
  if (query.subject) filter.subject = query.subject;
  if (query.type) filter.type = query.type;
  if (query.module) filter.module = query.module;
  Object.assign(filter, accessFilter);
  if (query.isEnabled !== undefined)
    filter.isEnabled = query.isEnabled === true || query.isEnabled === 'true';
  if (query.search)
    filter.$or = ['name', 'title', 'description'].map((field) => ({
      [field]: new RegExp(query.search, 'i'),
    }));
  const [items, total] = await Promise.all([
    Model.find(filter)
      .populate(populate)
      .sort(query.sort === 'displayOrder' ? { displayOrder: 1, createdAt: -1 } : { createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Model.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta({ ...pagination, total }) };
}

async function getById(Model, id, populate = '') {
  const item = await Model.findById(id).populate(populate);
  if (!item) throw new AppError('Resource not found', STATUS_CODES.NOT_FOUND);
  return item;
}

function create(Model, payload, userId) {
  return Model.create({
    ...payload,
    createdBy: payload.createdBy || userId,
    updatedBy: payload.updatedBy || userId,
  });
}
async function update(Model, id, payload) {
  const item = await Model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!item) throw new AppError('Resource not found', STATUS_CODES.NOT_FOUND);
  return item;
}
async function remove(Model, id, userId, payload = {}) {
  const item = await Model.findByIdAndUpdate(
    id,
    { ...payload, isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    { new: true, runValidators: true }
  );
  if (!item) throw new AppError('Resource not found', STATUS_CODES.NOT_FOUND);
  return item;
}
async function restore(Model, id, userId) {
  const item = await Model.findByIdAndUpdate(
    id,
    { isDeleted: false, restoredAt: new Date(), restoredBy: userId },
    { new: true }
  );
  if (!item) throw new AppError('Resource not found', STATUS_CODES.NOT_FOUND);
  return item;
}
async function permanentRemove(Model, id) {
  const item = await Model.findByIdAndDelete(id);
  if (!item) throw new AppError('Resource not found', STATUS_CODES.NOT_FOUND);
}

module.exports = { list, getById, create, update, remove, restore, permanentRemove };
