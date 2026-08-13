const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');
const schema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    questionText: { type: String, required: true, trim: true },
    normalizedText: { type: String, required: true, index: true },
    // The same wording is allowed when its set of answer options differs.
    normalizedOptions: { type: String, required: true, index: true },
    options: [
      {
        key: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
        text: { type: String, required: true },
      },
    ],
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'], required: true, select: false },
    explanation: { type: String, select: false },
    questionType: { type: String, default: 'MCQ', trim: true },
    questionImage: String,
    optionImages: {
      A: String,
      B: String,
      C: String,
      D: String,
    },
    explanationImage: String,
    marks: { type: Number, min: 0, default: 1 },
    negativeMarks: { type: Number, min: 0, default: 0 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    chapter: String,
    topic: String,
    status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' },
    importBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionImport' },
  },
  { timestamps: true }
);
schema.plugin(auditPlugin);
schema.pre('validate', function validateOptions() {
  if (!this.normalizedOptions) {
    const byKey = Object.fromEntries((this.options || []).map((option) => [option.key, option.text]));
    this.normalizedOptions = ['A', 'B', 'C', 'D']
      .map((key) => String(byKey[key] || '').trim().replace(/\s+/g, ' ').toLowerCase())
      .join('\u001f');
  }
  const keys = (this.options || []).map((option) => option.key);
  if (keys.length < 2) this.invalidate('options', 'At least two answer options are required');
  if (new Set(keys).size !== keys.length)
    this.invalidate('options', 'Answer option keys must be unique');
  if (this.correctOption && !keys.includes(this.correctOption))
    this.invalidate('correctOption', 'Correct option must match an available answer option');
});
schema.index({ course: 1, subject: 1, normalizedText: 1, normalizedOptions: 1 }, { unique: true });
module.exports = mongoose.model('Question', schema);
