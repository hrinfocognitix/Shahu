const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const academyRecordSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ['syllabus', 'assignment', 'result', 'mark', 'notification', 'setting', 'report', 'payment', 'admission', 'payment-account', 'course-purchase'],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: String,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: Number,
    maximumScore: Number,
    dueDate: Date,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'active' },
    scheduledAt: Date,
    audience: { type: String, default: 'all' },
    exportUrls: {
      pdf: String,
      excel: String,
      csv: String
    }
  },
  { timestamps: true }
);

academyRecordSchema.plugin(auditPlugin);
academyRecordSchema.index({ module: 1, createdAt: -1 });
module.exports = mongoose.model('AcademyRecord', academyRecordSchema);
