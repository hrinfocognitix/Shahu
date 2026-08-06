const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    // Each mobile mock-test page is recorded as its own attempt, allowing
    // staff to review page-level marks for a student.
    mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionImport', index: true },
    mockPage: { type: Number, min: 1 },
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        selectedOption: String,
        correct: Boolean,
        marksAwarded: Number,
      },
    ],
    score: Number,
    maximumScore: Number,
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
schema.index({ student: 1, subject: 1, submittedAt: -1 });
// A retest replaces the result for the same page instead of creating another mark.
schema.index({ student: 1, mockTest: 1, mockPage: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('QuestionAttempt', schema);
