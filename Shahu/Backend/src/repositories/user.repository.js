const User = require('../models/User');

const create = (payload) => User.create(payload);
const findByEmail = (email, includeSecrets = false) => {
  const query = User.findOne({ email });
  return includeSecrets ? query.select('+password +refreshTokens +authVersion') : query;
};
const findTeacherByMobile = (mobile, excludeId) =>
  User.findOne({
    role: 'teacher',
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ 'profile.mobile': mobile }, { 'profile.phone': mobile }],
  });
const findByEmailExcluding = (email, excludeId) => User.findOne({ email, _id: { $ne: excludeId } });
const findById = (id) => User.findById(id);
const findByIdForAuth = (id) => User.findById(id).select('+authVersion');
const findByIdWithPassword = (id) => User.findById(id).select('+password');
const findByIdWithSecrets = (id) => User.findById(id).select('+refreshTokens +authVersion');
const list = ({ filter, skip, limit }) =>
  User.find(filter)
    .populate('profile.subjects profile.assignedSubjects')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
const count = (filter) => User.countDocuments(filter);
const updateById = (id, payload) => User.findByIdAndUpdate(id, payload, { new: true });
const deleteById = (id) => User.findByIdAndDelete(id);

module.exports = {
  create,
  findByEmail,
  findByEmailExcluding,
  findTeacherByMobile,
  findById,
  findByIdForAuth,
  findByIdWithPassword,
  findByIdWithSecrets,
  list,
  count,
  updateById,
  deleteById,
};
