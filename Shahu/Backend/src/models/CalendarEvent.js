const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['holiday', 'exam', 'seminar', 'assignment', 'live-class'], required: true },
    startDate: { type: Date, required: true },
    endDate: Date,
    description: String,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);
module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
