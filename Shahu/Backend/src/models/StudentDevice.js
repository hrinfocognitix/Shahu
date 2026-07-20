const mongoose = require('mongoose');
const studentDeviceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uuid: { type: String, required: true, unique: true, trim: true, index: true },
  platform: { type: String, default: 'android' }, model: String, appVersion: String,
  firstSeenAt: { type: Date, default: Date.now }, lastSeenAt: { type: Date, default: Date.now }, isActive: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('StudentDevice', studentDeviceSchema);
