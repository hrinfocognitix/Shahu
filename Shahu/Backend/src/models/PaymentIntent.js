const mongoose = require('mongoose');

// This record represents a manual UPI payment request. Creating or opening a UPI link is never proof
// of payment; only an administrator can move it to VERIFIED.
const paymentIntentSchema = new mongoose.Schema(
  {
    transactionReference: { type: String, required: true, unique: true, trim: true, index: true },
    internalReference: { type: String, required: true, unique: true, sparse: true, trim: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    paymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademyRecord', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    buyer: {
      name: { type: String, trim: true },
      mobileNo: { type: String, trim: true },
      age: Number,
      education: String,
      address: String,
      deviceUuid: String,
    },
    provider: { type: String, enum: ['upi', 'gateway', 'razorpay'], default: 'upi' },
    paymentMode: { type: String, enum: ['direct-upi', 'merchant-gateway'], default: 'direct-upi' },
    merchantType: { type: String, enum: ['personal', 'business'], default: 'personal' },
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    upiId: { type: String, required: true, lowercase: true, trim: true },
    payeeName: { type: String, required: true, trim: true },
    transactionNote: { type: String, required: true, trim: true },
    paymentMethod: { type: String, default: 'UPI', trim: true },
    paymentApp: { type: String, trim: true },
    utrNumber: { type: String, trim: true, uppercase: true, sparse: true, unique: true, index: true },
    paymentScreenshotUrl: { type: String, trim: true },
    userNote: { type: String, trim: true, maxlength: 1000 },
    // A purchaser has no student account until approval. This short-lived capability binds submission
    // and status reads to the device that created the verified payment request.
    accessTokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VERIFICATION_PENDING'],
      default: 'PENDING_PAYMENT',
      index: true,
    },
    submittedAt: Date,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    razorpay: {
      orderId: { type: String, trim: true, sparse: true, unique: true, index: true },
      qrId: { type: String, trim: true, sparse: true, unique: true, index: true },
      paymentId: { type: String, trim: true, sparse: true, unique: true, index: true },
      signature: { type: String, trim: true, select: false },
      qrImageUrl: { type: String, trim: true },
      qrContent: { type: String, trim: true },
      expiresAt: Date,
      paidAt: Date,
      webhookEventIds: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

paymentIntentSchema.index({ course: 1, email: 1, createdAt: -1 });
module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
