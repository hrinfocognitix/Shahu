const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, enum: ['all', 'students', 'teachers'], default: 'all' },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: Date,
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);
module.exports = mongoose.model('Announcement', announcementSchema);
