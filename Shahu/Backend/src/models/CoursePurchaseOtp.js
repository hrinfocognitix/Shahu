const mongoose = require('mongoose');

const coursePurchaseOtpSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  name: { type: String, required: true, trim: true },
  mobileNo: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  age: { type: String, required: true, trim: true },
  education: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0, min: 0 },
  verifiedAt: Date,
}, { timestamps: true });

coursePurchaseOtpSchema.index({ course: 1, email: 1 }, { unique: true });
module.exports = mongoose.model('CoursePurchaseOtp', coursePurchaseOtpSchema);
