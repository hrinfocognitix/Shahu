const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const contentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['material', 'note', 'question-paper', 'video', 'assignment', 'gallery', 'slide', 'achievement'], required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    year: String,
    examType: String,
    dueDate: Date,
    resourceUrl: String,
    resourceType: String,
    fileType: String,
    thumbnail: String,
    imageUrl: String,
    videoUrl: String,
    scheduledAt: Date,
    media: [{
      _id: false,
      url: { type: String, required: true },
      type: { type: String, enum: ['image', 'video'], required: true }
    }],
    externalUrl: String,
    displayOrder: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
    visibility: { type: String, enum: ['public', 'course', 'subject', 'hidden'], default: 'public' },
    downloadable: { type: Boolean, default: true },
    category: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' }
  },
  { timestamps: true, discriminatorKey: 'contentType' }
);

contentSchema.plugin(auditPlugin);
contentSchema.index({ type: 1, course: 1, subject: 1, createdAt: -1 });
module.exports = mongoose.model('Content', contentSchema);
