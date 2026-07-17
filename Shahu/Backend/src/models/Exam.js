const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const questionSchema = new mongoose.Schema({
    prompt: { type: String, required: true },
  type: { type: String, enum: ['single-correct', 'multiple-correct', 'true-false', 'fill-blank', 'image', 'short-answer', 'long-answer'], required: true },
  options: [String],
  correctAnswers: [String],
  marks: { type: Number, min: 0, required: true },
  explanation: String
});

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    examCode: { type: String, unique: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    durationMinutes: { type: Number, min: 1, default: 60 },
    totalMarks: { type: Number, min: 0, default: 0 },
    startsAt: Date,
    endsAt: Date,
    negativeMarks: { type: Number, min: 0, default: 0 },
    passingMarks: { type: Number, min: 0, default: 0 },
    instructions: String,
    timerEnabled: { type: Boolean, default: true },
    randomQuestions: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    autoSubmit: { type: Boolean, default: true },
    leaderboardEnabled: { type: Boolean, default: true },
    answerReviewEnabled: { type: Boolean, default: true },
    questions: [questionSchema],
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' }
  },
  { timestamps: true }
);
examSchema.plugin(auditPlugin);
examSchema.pre('validate', async function setExamCode(next) {
  if (!this.examCode) {
    const count = await mongoose.model('Exam').countDocuments();
    this.examCode = `EXM-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});
module.exports = mongoose.model('Exam', examSchema);
