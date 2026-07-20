const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');
const schema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    chapter: { type: String, required: true, trim: true },
    topic: { type: String, trim: true },
    description: String,
    learningObjectives: [String],
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' },
  },
  { timestamps: true }
);
schema.plugin(auditPlugin);
schema.index({ course: 1, subject: 1, displayOrder: 1 });
module.exports = mongoose.model('SyllabusUnit', schema);
