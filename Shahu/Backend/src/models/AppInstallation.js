const mongoose = require('mongoose');

// One document per installed app/device. This deliberately does not require a
// login so the academy can measure installs before a student purchases a course.
const appInstallationSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true, trim: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    platform: { type: String, default: 'android', trim: true },
    appVersion: { type: String, trim: true },
    fcmToken: { type: String, trim: true, index: true },
    notificationsEnabled: { type: Boolean, default: false },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppInstallation', appInstallationSchema);
