const User = require('../models/User');

const create = payload => User.create(payload);
const findByEmail = (email, includeSecrets = false) => {
  const query = User.findOne({ email });
  return includeSecrets ? query.select('+password +refreshTokens') : query;
};
const findById = id => User.findById(id);
const findByIdWithPassword = id => User.findById(id).select('+password');
const findByIdWithSecrets = id => User.findById(id).select('+refreshTokens');
const list = ({ filter, skip, limit }) =>
  User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
const listWithInitialPasswords = ({ filter, skip, limit }) =>
  User.find(filter).select('+initialPassword').sort({ createdAt: -1 }).skip(skip).limit(limit);
const count = filter => User.countDocuments(filter);
const updateById = (id, payload) => User.findByIdAndUpdate(id, payload, { new: true });
const deleteById = id => User.findByIdAndDelete(id);

module.exports = { create, findByEmail, findById, findByIdWithPassword, findByIdWithSecrets, list, listWithInitialPasswords, count, updateById, deleteById };
