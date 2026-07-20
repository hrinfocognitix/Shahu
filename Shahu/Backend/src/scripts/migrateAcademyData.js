const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const AcademyRecord = require('../models/AcademyRecord');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

const apply = process.argv.includes('--apply');
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const statusOf = (value) => {
  const status = String(value || '').toLowerCase();
  if (['successful', 'success', 'verified', 'active', 'paid'].includes(status)) return 'successful';
  if (['failed', 'rejected'].includes(status)) return 'failed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  if (status === 'refunded') return 'refunded';
  return 'pending';
};

async function migratePricing(summary) {
  const courses = await Course.find({ isDeleted: { $ne: true } });
  for (const course of courses) {
    const actualPrice = number(course.actualPrice || course.price || course.fees);
    const payablePrice = number(course.fees || actualPrice);
    const discountValue =
      course.discountType === 'fixed'
        ? Math.max(0, actualPrice - payablePrice)
        : number(
            course.discountValue ||
              course.discountPercent ||
              (actualPrice ? ((actualPrice - payablePrice) / actualPrice) * 100 : 0)
          );
    const discountPercent = actualPrice
      ? Math.max(0, Math.min(100, ((actualPrice - payablePrice) / actualPrice) * 100))
      : 0;
    const update = {
      actualPrice,
      price: actualPrice,
      fees: payablePrice,
      actualPriceMinor: Math.round(actualPrice * 100),
      payablePriceMinor: Math.round(payablePrice * 100),
      discountAmountMinor: Math.max(0, Math.round((actualPrice - payablePrice) * 100)),
      discountType: course.discountType || 'percentage',
      discountValue,
      discountPercent: Number(discountPercent.toFixed(2)),
      durationDays: number(course.durationDays || course.duration),
    };
    const pricingChanged = Object.entries(update).some(
      ([key, value]) => String(course[key] ?? '') !== String(value)
    );
    const existingDetails = new Set(
      (course.subjectDetails || []).map((detail) => String(detail.subject?._id || detail.subject))
    );
    const missingSubjectDetails = (course.subjects || []).filter(
      (subject) => !existingDetails.has(String(subject?._id || subject))
    );
    if (pricingChanged) summary.coursePricing += 1;
    if (missingSubjectDetails.length) summary.courseSubjectDetails += 1;
    if (apply) await Course.updateOne({ _id: course._id }, { $set: update });
    if (apply && missingSubjectDetails.length) {
      await Course.updateOne(
        { _id: course._id },
        {
          $push: {
            subjectDetails: {
              $each: missingSubjectDetails.map((subject, index) => ({
                subject: subject?._id || subject,
                description: '',
                displayOrder: (course.subjectDetails || []).length + index,
                sections: [],
              })),
            },
          },
        }
      );
    }
  }
}

async function migratePurchases(summary) {
  const records = await AcademyRecord.find({
    module: 'course-purchase',
    isDeleted: { $ne: true },
  }).populate('course');
  for (const record of records) {
    const payload = record.payload || {};
    const course = record.course;
    if (!course || !payload.transactionId || !payload.email) {
      summary.skipped += 1;
      continue;
    }
    let transaction = await Transaction.findOne({
      $or: [
        { legacyPurchase: record._id },
        { transactionReference: String(payload.transactionId).trim() },
      ],
    });
    if (!transaction) {
      summary.transactions += 1;
      if (apply)
        transaction = await Transaction.create({
          purchaseId: `PUR-LEGACY-${String(record._id).toUpperCase()}`,
          legacyPurchase: record._id,
          transactionReference: String(payload.transactionId).trim(),
          idempotencyKey: `legacy:${record._id}`,
          course: course._id,
          paymentAccount: payload.paymentAccountId || undefined,
          buyer: {
            name: payload.studentName || record.title || 'Student',
            email: String(payload.email).trim().toLowerCase(),
            mobileNo: String(payload.mobileNo || 'Not supplied'),
            deviceUuid: payload.deviceUuid,
            age: number(payload.age),
            education: payload.education,
            address: payload.address,
            photoUrl: payload.photoUrl,
          },
          pricing: {
            originalPrice: number(course.actualPrice || course.price || payload.amount),
            discountType: course.discountType || 'percentage',
            discountValue: number(course.discountValue || course.discountPercent),
            discountPercent: number(course.discountPercent),
            payablePrice: number(course.fees || payload.amount),
            paidAmount: number(payload.amount || course.fees),
            originalPriceMinor: Math.round(
              number(course.actualPrice || course.price || payload.amount) * 100
            ),
            payablePriceMinor: Math.round(number(course.fees || payload.amount) * 100),
            paidAmountMinor: Math.round(number(payload.amount || course.fees) * 100),
            discountAmountMinor: Math.max(
              0,
              Math.round(
                (number(course.actualPrice || course.price || payload.amount) -
                  number(payload.amount || course.fees)) *
                  100
              )
            ),
          },
          paymentMethod: payload.paymentMethod || 'legacy',
          paymentDate: payload.paymentDate || record.createdAt,
          status: statusOf(record.status),
          note: payload.note,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
    }
    if (transaction && !transaction.legacyPurchase) {
      summary.legacyPurchaseLinks += 1;
      if (apply) {
        transaction.legacyPurchase = record._id;
        await transaction.save();
      }
    }
    if (!apply || !transaction || transaction.status !== 'successful') continue;
    const student = await User.findOne({
      email: String(payload.email).trim().toLowerCase(),
      role: ROLES.STUDENT,
    });
    if (!student) {
      summary.successfulWithoutStudent += 1;
      continue;
    }
    const existing = await Enrollment.exists({ transaction: transaction._id });
    if (existing) continue;
    const validFrom = new Date(transaction.paymentDate || record.createdAt);
    const validityDays = Math.max(1, number(course.durationDays || course.duration || 1));
    const validUntil = new Date(validFrom);
    validUntil.setUTCDate(validUntil.getUTCDate() + validityDays);
    await Enrollment.create({
      student: student._id,
      course: course._id,
      transaction: transaction._id,
      purchaseDate: validFrom,
      validFrom,
      validUntil,
      validityDays,
      status: validUntil >= new Date() ? 'active' : 'expired',
      validityMode: 'automatic',
    });
    transaction.student = student._id;
    await transaction.save();
    summary.enrollments += 1;
  }
}

async function migratePurchaseTracking(summary) {
  const transactions = await Transaction.find({
    $or: [{ purchaseId: { $exists: false } }, { purchaseId: '' }],
  }).select('_id transactionReference receiptNumber');
  summary.purchaseTrackingIds = transactions.length;
  if (!apply) return;
  for (const transaction of transactions) {
    const purchaseId = `PUR-LEGACY-${String(transaction._id).toUpperCase()}`;
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          purchaseId,
          receiptNumber: transaction.receiptNumber || `RCP-${purchaseId}`,
        },
      }
    );
  }
}

async function run() {
  await connectDatabase();
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    coursePricing: 0,
    courseSubjectDetails: 0,
    transactions: 0,
    enrollments: 0,
    purchaseTrackingIds: 0,
    legacyPurchaseLinks: 0,
    successfulWithoutStudent: 0,
    skipped: 0,
  };
  await migratePricing(summary);
  await migratePurchases(summary);
  await migratePurchaseTracking(summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) console.log('Dry run only. Re-run with --apply after reviewing this summary.');
  await mongoose.disconnect();
}
run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
