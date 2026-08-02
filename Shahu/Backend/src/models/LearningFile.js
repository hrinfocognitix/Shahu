const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');
const schema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    syllabusUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'SyllabusUnit' },
    title: { type: String, required: true, trim: true },
    description: String,
    category: {
      type: String,
      enum: ['syllabus-copy', 'notes', 'generated-questions', 'question-paper', 'mock-test', 'other'],
      default: 'notes',
      index: true,
    },
    unitTitle: { type: String, trim: true, default: '' },
    customType: { type: String, trim: true, default: '' },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    copiedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningFile', default: null },
    status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' },
    legacyContent: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
  },
  { timestamps: true }
);
schema.plugin(auditPlugin);
schema.index({ course: 1, subject: 1, createdAt: -1 });
module.exports = mongoose.model('LearningFile', schema);
