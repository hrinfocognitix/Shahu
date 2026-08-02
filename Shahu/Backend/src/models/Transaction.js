const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const transactionSchema = new mongoose.Schema(
  {
    purchaseId: { type: String, unique: true, sparse: true, trim: true, index: true },
    transactionReference: { type: String, required: true, unique: true, trim: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true, index: true },
    legacyPurchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademyRecord',
      unique: true,
      sparse: true,
      index: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    paymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademyRecord' },
    buyer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      mobileNo: { type: String, required: true, trim: true },
      deviceUuid: { type: String, trim: true },
      age: Number,
      education: String,
      address: String,
      photoUrl: String,
    },
    pricing: {
      originalPrice: { type: Number, min: 0 },
      discountType: String,
      discountValue: { type: Number, min: 0 },
      discountPercent: { type: Number, min: 0 },
      payablePrice: { type: Number, min: 0 },
      paidAmount: { type: Number, min: 0 },
      originalPriceMinor: { type: Number, min: 0 },
      payablePriceMinor: { type: Number, min: 0 },
      paidAmountMinor: { type: Number, min: 0 },
      discountAmountMinor: { type: Number, min: 0 },
    },
    paymentMethod: { type: String, required: true, trim: true },
    submittedFrom: { type: String, enum: ['android', 'laptop'], default: 'android', index: true },
    gatewayReference: { type: String, trim: true, index: true },
    receiptNumber: { type: String, trim: true, index: true },
    receiptEmailedAt: Date,
    receiptEmailError: { type: String, select: false },
    paymentAccountSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentDate: Date,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    failureReason: String,
    note: String,
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { timestamps: true }
);
transactionSchema.plugin(auditPlugin);
transactionSchema.index({ course: 1, status: 1, createdAt: -1 });
transactionSchema.index({ 'buyer.email': 1, createdAt: -1 });
transactionSchema.index({ 'buyer.mobileNo': 1, createdAt: -1 });
module.exports = mongoose.model('Transaction', transactionSchema);
