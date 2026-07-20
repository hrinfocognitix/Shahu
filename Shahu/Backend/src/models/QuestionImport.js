const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');
const schema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    originalFilename: String,
    storedFilename: String,
    fileUrl: String,
    totalRows: Number,
    validRows: Number,
    invalidRows: Number,
    status: { type: String, enum: ['previewed', 'imported', 'rejected'], default: 'previewed' },
    rows: [
      {
        rowNumber: Number,
        data: mongoose.Schema.Types.Mixed,
        valid: Boolean,
        validationErrors: [String],
      },
    ],
    importedAt: Date,
  },
  { timestamps: true }
);
schema.plugin(auditPlugin);
module.exports = mongoose.model('QuestionImport', schema);
