const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
    },
    purchaseDate: { type: Date, required: true },
    validFrom: { type: Date, required: true, index: true },
    validUntil: { type: Date, required: true, index: true },
    validityDays: { type: Number, min: 1, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'pending', 'cancelled', 'refunded'],
      default: 'active',
      index: true,
    },
    validityMode: { type: String, enum: ['automatic', 'manual'], default: 'automatic' },
    validityHistory: [
      {
        previousFrom: Date,
        previousUntil: Date,
        updatedFrom: Date,
        updatedUntil: Date,
        reason: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
enrollmentSchema.plugin(auditPlugin);
enrollmentSchema.pre('validate', function validateDates() {
  if (this.validFrom && this.validUntil && this.validUntil < this.validFrom) {
    this.invalidate('validUntil', 'Valid-until date must be on or after valid-from date');
  }
});
enrollmentSchema.index({ student: 1, course: 1, status: 1 });
module.exports = mongoose.model('Enrollment', enrollmentSchema);
