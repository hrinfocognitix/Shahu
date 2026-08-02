const mongoose = require('mongoose');

// Import rows live in their own collection so large papers do not exceed
// MongoDB's 16 MB maximum document size for a QuestionImport preview.
const schema = new mongoose.Schema(
  {
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionImport',
      required: true,
      index: true,
    },
    rowNumber: { type: Number, required: true },
    data: mongoose.Schema.Types.Mixed,
    valid: { type: Boolean, required: true },
    skipped: { type: Boolean, default: false },
    validationErrors: [String],
  },
  { timestamps: true },
);

schema.index({ importBatch: 1, valid: 1, rowNumber: 1 });

module.exports = mongoose.model('QuestionImportRow', schema);
