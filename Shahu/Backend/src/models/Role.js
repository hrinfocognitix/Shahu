const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: Object.values(ROLES),
      unique: true,
      required: true
    },
    permissions: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
