const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
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
module.exports = mongoose.model('QuestionAttempt', schema);
