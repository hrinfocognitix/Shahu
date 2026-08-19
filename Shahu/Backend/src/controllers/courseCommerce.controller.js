const Course = require('../models/Course');
const Subject = require('../models/Subject');
const AcademyRecord = require('../models/AcademyRecord');
const Transaction = require('../models/Transaction');
const Enrollment = require('../models/Enrollment');
const LearningFile = require('../models/LearningFile');
const Question = require('../models/Question');
const QuestionImport = require('../models/QuestionImport');
const QuestionAttempt = require('../models/QuestionAttempt');
const StudentDevice = require('../models/StudentDevice');
const CoursePurchaseOtp = require('../models/CoursePurchaseOtp');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { hashPassword } = require('../helpers/bcrypt.helper');
const crypto = require('crypto');
const { ROLES } = require('../constants/roles');
const { STATUS_CODES } = require('../constants/statusCodes');
const apiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const { sendEmail } = require('../services/email.service');
const { createReceiptPdf } = require('../services/receiptPdf.service');
const { createPurchaseConfirmationEmail } = require('../services/purchaseEmail.service');
const logger = require('../config/logger');
const { isCompleteUpiId, normalizeUpiId } = require('../services/paymentIntent.service');

const createPurchaseId = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PUR-${day}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
};

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const duplicateAccountError = () => new AppError(
  'This email or mobile number is mapped to another student account. Correct the account mapping before enrolling a course.',
  STATUS_CODES.CONFLICT
);

const hashCourseOtp = (courseId, code) => crypto.createHash('sha256').update(`course-purchase:${courseId}:${code}`).digest('hex');

const requestCourseOtp = asyncHandler(async (req, res) => {
  const { courseId, name, mobileNo, email, age, education, address } = req.body;
  if (![courseId, name, mobileNo, email, age, education, address].every(value => String(value || '').trim())) throw new AppError('All enrollment fields are required', STATUS_CODES.BAD_REQUEST);
  const course = await Course.findById(courseId).select('_id name status isPublished');
  if (!course || course.status === 'inactive' || course.isPublished === false) throw new AppError('This course is unavailable', STATUS_CODES.NOT_FOUND);
  const normalizedEmail = String(email).trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const emailRef = crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12);

  const code = String(crypto.randomInt(100000, 1000000));
  logger.info('Course enrollment OTP requested', { requestId: req.requestId, courseId: String(course._id), emailRef });
  await CoursePurchaseOtp.findOneAndUpdate({ course: course._id, email: normalizedEmail }, { name: String(name).trim(), mobileNo: String(mobileNo).trim(), email: normalizedEmail, age: String(age).trim(), education: String(education).trim(), address: String(address).trim(), codeHash: hashCourseOtp(course._id, code), expiresAt, attempts: 0, verifiedAt: null }, { upsert: true, returnDocument: 'after', runValidators: true });
  logger.info('Course enrollment OTP record saved', { requestId: req.requestId, courseId: String(course._id), emailRef, expiresAt });
  const delivery = await sendEmail({ to: normalizedEmail, subject: `Your ${course.name} enrollment OTP`, text: `Your enrollment OTP is ${code}. It expires in 10 minutes.`, html: `<p>Your enrollment OTP for <strong>${course.name}</strong> is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes.</p>` });
  if (delivery?.skipped) throw new AppError('Email OTP delivery is not configured', STATUS_CODES.SERVICE_UNAVAILABLE);
  logger.info('Course enrollment OTP sent', { requestId: req.requestId, courseId: String(course._id), emailRef, expiresAt });
  return apiResponse.success(res, { message: 'OTP sent to your email', data: { expiresAt } });
});

const verifyCourseOtp = asyncHandler(async (req, res) => {
  const { courseId, email, otp } = req.body;
  if (!courseId || !email) throw new AppError('Course and email are required', STATUS_CODES.BAD_REQUEST);
  if (!/^\d{6}$/.test(String(otp || ''))) throw new AppError('A valid six-digit OTP is required', STATUS_CODES.BAD_REQUEST);
  const record = await CoursePurchaseOtp.findOne({ course: courseId, email: String(email).trim().toLowerCase() }).select('+codeHash');
  if (!record || record.expiresAt < new Date() || record.attempts >= 5) throw new AppError('Invalid or expired OTP', STATUS_CODES.UNAUTHORIZED);
  const supplied = Buffer.from(hashCourseOtp(courseId, String(otp)));
  const expected = Buffer.from(record.codeHash);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) { record.attempts += 1; await record.save(); throw new AppError('Invalid or expired OTP', STATUS_CODES.UNAUTHORIZED); }
  record.verifiedAt = new Date();
  await record.save();
  return apiResponse.success(res, { message: 'Email verified. You can continue to payment.' });
});

function normalizeValidity(course, paymentDate) {
  const days = Number(course.durationDays || 0);
  if (!days) return null;

  const start = new Date(paymentDate || Date.now());
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return {
    durationDays: days,
    startDate: start,
    endDate: end,
  };
}

function buildPricingSnapshot(course) {
  const payablePrice = Number(course.fees || 0);
  const originalPrice = Number(course.actualPrice || course.price || payablePrice);
  return {
    originalPrice,
    discountType: course.discountType || 'percentage',
    discountValue: Number(course.discountValue || course.discountPercent || 0),
    discountPercent: Number(course.discountPercent || 0),
    payablePrice,
    paidAmount: payablePrice,
    originalPriceMinor: Math.round(originalPrice * 100),
    payablePriceMinor: Math.round(payablePrice * 100),
    paidAmountMinor: Math.round(payablePrice * 100),
    discountAmountMinor: Math.max(0, Math.round((originalPrice - payablePrice) * 100)),
  };
}

const createPurchase = asyncHandler(async (req, res) => {
  const isManualSubmission = req.user?.role === ROLES.SUPERADMIN;
  if (String(req.get('X-Client-Platform') || '').toLowerCase() !== 'android' && !isManualSubmission) {
    throw new AppError(
      'Course purchases can be submitted only through the Android application or by superadmin from the laptop',
      STATUS_CODES.FORBIDDEN
    );
  }
  const {
    courseId,
    paymentAccountId,
    name,
    email,
    age,
    education,
    address,
    mobileNo,
    deviceUuid,
    photoUrl,
    transactionId,
    paymentMethod,
    paymentDate,
    note,
  } = req.body || {};

  if (
    !courseId ||
    !name ||
    !email ||
    !age ||
    !education ||
    !address ||
    !mobileNo ||
    !transactionId ||
    !paymentMethod
  ) {
    throw new AppError(
      'Course, candidate details, transaction ID, and payment method are required',
      STATUS_CODES.BAD_REQUEST
    );
  }

  const course = await Course.findOne({
    _id: courseId,
    status: 'active',
    isDeleted: { $ne: true },
    $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
  }).select(
    '_id name fees price actualPrice discountType discountValue discountPercent duration durationDays primaryPaymentAccount acceptedPaymentAccounts'
  );

  if (!course) {
    throw new AppError('Course not found', STATUS_CODES.NOT_FOUND);
  }
  const allowedAccountIds = [
    course.primaryPaymentAccount,
    ...(course.acceptedPaymentAccounts || []),
  ]
    .filter(Boolean)
    .map(String);
  const selectedPaymentAccountId = paymentAccountId || course.primaryPaymentAccount;
  if (selectedPaymentAccountId && !allowedAccountIds.includes(String(selectedPaymentAccountId))) {
    throw new AppError(
      'The selected payment account is not assigned to this course',
      STATUS_CODES.BAD_REQUEST
    );
  }
  const paymentAccount = selectedPaymentAccountId
    ? await AcademyRecord.findOne({
        _id: selectedPaymentAccountId,
        module: 'payment-account',
        status: 'active',
        isDeleted: { $ne: true },
      })
    : null;
  if (selectedPaymentAccountId && !paymentAccount) {
    throw new AppError(
      'The selected payment account is inactive or unavailable',
      STATUS_CODES.CONFLICT
    );
  }

  const idempotencyKey = String(req.get('Idempotency-Key') || transactionId).trim();
  if (!idempotencyKey) {
    throw new AppError('A transaction reference or idempotency key is required', STATUS_CODES.BAD_REQUEST);
  }
  const existingTransaction = await Transaction.findOne({
    $or: [{ idempotencyKey }, { transactionReference: String(transactionId).trim() }],
  });
  if (existingTransaction) {
    return apiResponse.success(res, {
      message: 'Purchase submission already received',
      data: existingTransaction,
    });
  }

  const payablePrice = Number(course.fees || 0);
  const pricing = buildPricingSnapshot(course);
  const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
  if (Number.isNaN(parsedPaymentDate.getTime())) {
    throw new AppError('Payment date is invalid', STATUS_CODES.BAD_REQUEST);
  }
  const validity = normalizeValidity(course, parsedPaymentDate);
  let transaction;
  let created = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      transaction = await Transaction.findOne({
        $or: [{ idempotencyKey }, { transactionReference: String(transactionId).trim() }],
      }).session(session);
      if (transaction) return;
      const [record] = await AcademyRecord.create(
        [{
          module: 'course-purchase',
          title: `${course.name} purchase`,
          description: `${name} submitted a course purchase request`,
          course: course._id,
          status: 'pending-verification',
          payload: {
            studentName: String(name).trim(), email: String(email).trim().toLowerCase(),
            age: Number(age), education: String(education).trim(), address: String(address).trim(),
            mobileNo: String(mobileNo).trim(), deviceUuid: String(deviceUuid || '').trim(),
            photoUrl: String(photoUrl || '').trim(), transactionId: String(transactionId).trim(),
            paymentMethod: String(paymentMethod).trim(), paymentDate: parsedPaymentDate,
            amount: payablePrice, note: String(note || '').trim(), courseName: course.name,
            paymentAccountId: paymentAccount?._id || null,
            paymentAccount: paymentAccount?.payload || null, validity,
          },
        }],
        { session }
      );
      [transaction] = await Transaction.create(
        [{
          purchaseId: createPurchaseId(),
          transactionReference: String(transactionId).trim(), idempotencyKey,
          legacyPurchase: record._id, course: course._id, paymentAccount: paymentAccount?._id,
          buyer: { name, email, mobileNo, deviceUuid, age: Number(age), education, address, photoUrl },
          pricing,
          paymentMethod, paymentDate: parsedPaymentDate,
          submittedFrom: isManualSubmission ? 'laptop' : 'android',
          paymentAccountSnapshot: paymentAccount ? { title: paymentAccount.title, payload: paymentAccount.payload } : {},
          status: 'pending', note,
        }],
        { session }
      );
      created = true;
      record.payload.transactionRecordId = transaction._id;
      await record.save({ session });
    });
  } catch (error) {
    if (error?.code === 11000) {
      transaction = await Transaction.findOne({
        $or: [{ idempotencyKey }, { transactionReference: String(transactionId).trim() }],
      });
      if (transaction) {
        return apiResponse.success(res, {
          message: 'Purchase submission already received',
          data: transaction,
        });
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return apiResponse.success(res, {
    ...(created ? { statusCode: 201 } : {}),
    message: created ? 'Course purchase submitted' : 'Purchase submission already received',
    data: transaction,
  });
});

// This is deliberately separate from a laptop payment submission.  A superadmin
// can use it for an offline/manual admission, but the course fee is always read
// from the selected course and a student can only own a course once.
const manuallyEnrollStudent = asyncHandler(async (req, res) => {
  const { courseId, name, email, mobileNo, age, education, address, reason } = req.body || {};
  if (![courseId, name, email, mobileNo, reason].every((value) => String(value || '').trim())) {
    throw new AppError('Course, student name, email, mobile number, and admission reason are required', STATUS_CODES.BAD_REQUEST);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedMobile = normalizeMobile(mobileNo);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new AppError('Enter a valid email address', STATUS_CODES.BAD_REQUEST);
  }
  if (!/^\d{10}$/.test(normalizedMobile)) {
    throw new AppError('Enter a valid 10-digit mobile number', STATUS_CODES.BAD_REQUEST);
  }

  const course = await Course.findOne({
    _id: courseId,
    status: 'active',
    isDeleted: { $ne: true },
    $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
  }).select('_id name fees price actualPrice discountType discountValue discountPercent durationDays');
  if (!course) throw new AppError('Course not found or unavailable', STATUS_CODES.NOT_FOUND);

  // Query both identity fields.  A partial match is not safe to "merge" here:
  // it must be fixed by an administrator so one person keeps one account.
  const mobileVariants = [normalizedMobile, `+91${normalizedMobile}`, `91${normalizedMobile}`];
  const candidates = await User.find({
    $or: [
      { email: normalizedEmail },
      { 'profile.mobile': { $in: mobileVariants } },
      { 'profile.phone': { $in: mobileVariants } },
    ],
  }).select('+password');
  const matchingStudent = candidates.length === 1 ? candidates[0] : null;
  const matchingMobile = matchingStudent && [matchingStudent.profile?.mobile, matchingStudent.profile?.phone]
    .some((value) => normalizeMobile(value) === normalizedMobile);
  if (candidates.length > 1 || (matchingStudent && (matchingStudent.role !== ROLES.STUDENT || matchingStudent.email !== normalizedEmail || !matchingMobile))) {
    throw duplicateAccountError();
  }

  if (matchingStudent && !matchingStudent.isActive) {
    throw new AppError('This student account is inactive. Reactivate the account before enrolling a course.', STATUS_CODES.CONFLICT);
  }
  const studentId = matchingStudent?._id;
  if (studentId && await Enrollment.exists({ student: studentId, course: course._id })) {
    throw new AppError(`You have already purchased "${course.name}". Please open My Courses to access it.`, STATUS_CODES.CONFLICT);
  }

  const purchaseDate = new Date();
  const validityDays = Math.max(1, Number(course.durationDays || 1));
  const validUntil = new Date(purchaseDate);
  validUntil.setUTCDate(validUntil.getUTCDate() + validityDays);
  const purchaseId = createPurchaseId();
  const reference = `ADMIN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const pricing = buildPricingSnapshot(course);
  let student = matchingStudent;
  let enrollment;
  let transaction;
  let temporaryPassword;
  let createdStudent = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (!student) {
        temporaryPassword = crypto.randomBytes(9).toString('base64url');
        [student] = await User.create([{
          name: String(name).trim(), email: normalizedEmail,
          password: await hashPassword(temporaryPassword), role: ROLES.STUDENT,
          mustChangePassword: true, createdBy: req.user._id, updatedBy: req.user._id,
          profile: {
            mobile: normalizedMobile, phone: normalizedMobile, address: String(address || '').trim(),
            age: age === '' || age == null ? undefined : Number(age),
            educationQualification: String(education || '').trim(), admissionDate: purchaseDate,
            paymentStatus: 'successful', studentStatus: 'active',
          },
        }], { session });
        createdStudent = true;
      }

      // Recheck inside the transaction to protect simultaneous superadmin requests.
      if (await Enrollment.exists({ student: student._id, course: course._id }).session(session)) {
        throw new AppError(`You have already purchased "${course.name}". Please open My Courses to access it.`, STATUS_CODES.CONFLICT);
      }
      [transaction] = await Transaction.create([{
        purchaseId, transactionReference: reference, idempotencyKey: reference,
        student: student._id, course: course._id,
        buyer: {
          name: student.name, email: student.email, mobileNo: normalizedMobile,
          age: student.profile?.age, education: student.profile?.educationQualification,
          address: student.profile?.address,
        },
        pricing, paymentMethod: 'Superadmin manual enrollment', submittedFrom: 'laptop',
        status: 'successful', paymentDate: purchaseDate, verifiedAt: purchaseDate,
        verifiedBy: req.user._id, gatewayReference: reference, receiptNumber: `RCP-${purchaseId}`,
        note: `Superadmin admission: ${String(reason).trim()}`,
      }], { session });
      [enrollment] = await Enrollment.create([{
        student: student._id, course: course._id, transaction: transaction._id,
        purchaseDate, validFrom: purchaseDate, validUntil, validityDays, status: 'active',
        validityMode: 'manual', createdBy: req.user._id, updatedBy: req.user._id,
      }], { session });
      await User.findByIdAndUpdate(student._id, {
        $addToSet: { 'profile.purchasedCourses': course._id },
        $set: { 'profile.paymentStatus': 'successful', 'profile.studentStatus': 'active', updatedBy: req.user._id },
      }, { session });
      await AuditLog.create([{
        user: req.user._id, role: req.user.role, action: 'superadmin_student_enrolled',
        module: 'students', recordId: student._id,
        newValue: { course: course._id, enrollment: enrollment._id, transaction: transaction._id, fee: pricing.paidAmount },
        reason: String(reason).trim(), ipAddress: req.ip,
      }], { session });
    });
  } catch (error) {
    if (error?.code === 11000) {
      const account = await User.findOne({ email: normalizedEmail }).select('_id');
      if (account && await Enrollment.exists({ student: account._id, course: course._id })) {
        throw new AppError(`You have already purchased "${course.name}". Please open My Courses to access it.`, STATUS_CODES.CONFLICT);
      }
      throw duplicateAccountError();
    }
    throw error;
  } finally {
    await session.endSession();
  }

  try {
    const receiptPdf = createReceiptPdf({ receiptNumber: transaction.receiptNumber, purchaseId, student, course, transaction, enrollment });
    const purchaseEmail = createPurchaseConfirmationEmail({ student, course, transaction, enrollment, temporaryPassword });
    const delivery = await sendEmail({
      to: student.email, ...purchaseEmail,
      attachments: [{ filename: `${transaction.receiptNumber}.pdf`, content: receiptPdf, contentType: 'application/pdf' }],
    });
    if (!delivery?.skipped) transaction.receiptEmailedAt = new Date();
    else transaction.receiptEmailError = delivery.reason;
    await transaction.save();
  } catch (error) {
    logger.error(`Manual enrollment email failed for ${purchaseId}`, error);
    await Transaction.updateOne({ _id: transaction._id }, { $set: { receiptEmailError: String(error.message || 'Receipt email failed') } });
  }

  return apiResponse.success(res, {
    statusCode: STATUS_CODES.CREATED,
    message: createdStudent ? 'Student added and course enrolled. The temporary password and receipt were emailed.' : 'Course enrolled for the existing student. The receipt was emailed.',
    data: { student: { _id: student._id, name: student.name, email: student.email }, enrollment, transaction, courseFee: pricing.paidAmount, ...(temporaryPassword ? { temporaryPassword } : {}) },
  });
});

const listPurchases = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user?.role)) {
    throw new AppError('You are not allowed to view course purchases', STATUS_CODES.FORBIDDEN);
  }

  const filter = {};
  if (req.query.course) filter.course = req.query.course;
  if (req.query.status) filter.status = req.query.status;
  const items = await Transaction.find(filter)
    .populate('course paymentAccount student')
    .sort({ createdAt: -1 })
    .limit(200);
  return apiResponse.success(res, { message: 'Course purchases fetched', data: items });
});

const coursePaymentOptions = asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    _id: req.params.courseId,
    status: 'active',
    isDeleted: { $ne: true },
  }).populate('primaryPaymentAccount acceptedPaymentAccounts');
  if (!course) throw new AppError('Course not found', STATUS_CODES.NOT_FOUND);
  const records = [course.primaryPaymentAccount, ...(course.acceptedPaymentAccounts || [])].filter(
    (item) =>
      item && item.module === 'payment-account' && item.status === 'active' && !item.isDeleted
  );
  const unique = [...new Map(records.map((item) => [String(item._id), item])).values()];
  const data = unique.map((item) => {
    const payload = item.payload || {};
    const upiId = normalizeUpiId(payload.upiId);
    const completeUpiId = isCompleteUpiId(upiId) ? upiId : undefined;
    return {
      _id: item._id,
      title: item.title,
      description: item.description,
      isPrimary:
        String(course.primaryPaymentAccount?._id || course.primaryPaymentAccount) ===
        String(item._id),
      payload: {
        accountName: payload.merchantDisplayName || payload.accountName || payload.accountHolder,
        // Do not fall back to mobileNo. Only a complete VPA is allowed in the mobile payment link.
        upiId: completeUpiId,
        paymentMode: payload.paymentMode || 'direct-upi',
        supportsGpay: payload.supportsGpay !== false,
        supportsPhonePe: payload.supportsPhonePe !== false,
        supportsBhim: payload.supportsBhim !== false,
        supportsPaytm: payload.supportsPaytm !== false,
        isQrEnabled: Boolean(payload.isQrEnabled),
        qrType: payload.qrType === 'dynamic' ? 'dynamic' : 'static',
        qrCode: payload.isQrEnabled ? String(payload.qrCode || '').trim() : undefined,
      },
    };
  });
  return apiResponse.success(res, { message: 'Course payment options fetched', data });
});

const verifyPurchase = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  if (!['successful', 'failed'].includes(status))
    throw new AppError('Status must be successful or failed', STATUS_CODES.BAD_REQUEST);
  const transaction = await Transaction.findById(req.params.id).populate('course');
  if (!transaction) throw new AppError('Transaction not found', STATUS_CODES.NOT_FOUND);
  if (transaction.submittedFrom === 'laptop' && req.user.role !== ROLES.SUPERADMIN) {
    throw new AppError('Only superadmin can verify a laptop payment submission', STATUS_CODES.FORBIDDEN);
  }
  if (transaction.status === status)
    return apiResponse.success(res, {
      message: 'Transaction already processed',
      data: transaction,
    });
  if (transaction.status !== 'pending')
    throw new AppError(`Transaction is already ${transaction.status}`, STATUS_CODES.CONFLICT);

  if (status === 'failed') {
    transaction.status = 'failed';
    transaction.failureReason = String(req.body.reason || 'Payment verification failed').trim();
    transaction.verifiedAt = new Date();
    transaction.verifiedBy = req.user._id;
    const failureSession = await mongoose.startSession();
    try {
      await failureSession.withTransaction(async () => {
        await transaction.save({ session: failureSession });
        if (transaction.legacyPurchase) {
          await AcademyRecord.findByIdAndUpdate(
            transaction.legacyPurchase,
            {
              $set: {
                status: 'failed',
                'payload.verificationStatus': 'failed',
                'payload.failureReason': transaction.failureReason,
                'payload.verifiedAt': transaction.verifiedAt,
                'payload.verifiedBy': req.user._id,
              },
            },
            { session: failureSession }
          );
        }
        await AuditLog.create(
          [{
            user: req.user._id, role: req.user.role, action: 'payment_failed',
            module: 'transactions', recordId: transaction._id,
            newValue: { status: 'failed' }, reason: transaction.failureReason,
            ipAddress: req.ip,
          }],
          { session: failureSession }
        );
      });
    } finally {
      await failureSession.endSession();
    }
    return apiResponse.success(res, { message: 'Transaction marked failed', data: transaction });
  }

  let student;
  let enrollment;
  let temporaryPassword;
  // Access starts when payment is actually verified, never when a pending request was created.
  const purchaseDate = new Date();
  const validityDays = Number(transaction.course.durationDays || 1);
  const validUntil = new Date(purchaseDate);
  validUntil.setUTCDate(validUntil.getUTCDate() + validityDays);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      student = await User.findOne({ email: transaction.buyer.email }).session(session);
      if (!student) {
        temporaryPassword = crypto.randomBytes(9).toString('base64url');
        [student] = await User.create(
          [
            {
              name: transaction.buyer.name,
              email: transaction.buyer.email,
              password: await hashPassword(temporaryPassword),
              role: ROLES.STUDENT,
              mustChangePassword: true,
              profile: {
                phone: transaction.buyer.mobileNo,
                mobile: transaction.buyer.mobileNo,
                address: transaction.buyer.address,
                age: transaction.buyer.age,
                educationQualification: transaction.buyer.education,
                admissionDate: new Date(),
                paymentStatus: 'successful',
                studentStatus: 'active',
              },
              createdBy: req.user._id,
              updatedBy: req.user._id,
            },
          ],
          { session }
        );
      }
      enrollment = await Enrollment.findOneAndUpdate(
        { transaction: transaction._id },
        {
          $setOnInsert: {
            student: student._id,
            course: transaction.course._id,
            transaction: transaction._id,
            purchaseDate,
            validFrom: purchaseDate,
            validUntil,
            validityDays,
            status: 'active',
            validityMode: 'automatic',
            createdBy: req.user._id,
          },
          $set: { updatedBy: req.user._id },
        },
        { upsert: true, returnDocument: 'after', runValidators: true, session }
      );
      if (transaction.buyer.deviceUuid)
        await StudentDevice.findOneAndUpdate(
          { uuid: transaction.buyer.deviceUuid },
          {
            $set: { student: student._id, lastSeenAt: new Date(), isActive: true },
            $setOnInsert: { firstSeenAt: new Date(), platform: 'android' },
          },
          { upsert: true, returnDocument: 'after', session }
        );
      transaction.student = student._id;
      transaction.status = 'successful';
      transaction.verifiedAt = new Date();
      transaction.verifiedBy = req.user._id;
      transaction.gatewayReference = String(
        req.body.gatewayReference || transaction.transactionReference
      ).trim();
      transaction.receiptNumber = transaction.receiptNumber || `RCP-${transaction.purchaseId}`;
      await transaction.save({ session });
      if (transaction.legacyPurchase) {
        await AcademyRecord.findByIdAndUpdate(
          transaction.legacyPurchase,
          {
            $set: {
              student: student._id,
              status: 'successful',
              'payload.verificationStatus': 'successful',
              'payload.purchaseId': transaction.purchaseId,
              'payload.receiptNumber': transaction.receiptNumber,
              'payload.enrollmentId': enrollment._id,
              'payload.validFrom': purchaseDate,
              'payload.validUntil': validUntil,
              'payload.verifiedAt': transaction.verifiedAt,
              'payload.verifiedBy': req.user._id,
            },
          },
          { session }
        );
      }
      await User.findByIdAndUpdate(
        student._id,
        {
          $addToSet: { 'profile.purchasedCourses': transaction.course._id },
          $set: { 'profile.paymentStatus': 'successful', updatedBy: req.user._id },
        },
        { session }
      );
      await AuditLog.create(
        [
          {
            user: req.user._id,
            role: req.user.role,
            action: 'payment_verified_and_enrolled',
            module: 'transactions',
            recordId: transaction._id,
            newValue: {
              status: 'successful',
              student: student._id,
              enrollment: enrollment._id,
              validFrom: purchaseDate,
              validUntil,
            },
            reason: String(req.body.reason || 'Payment manually verified').trim(),
            ipAddress: req.ip,
          },
        ],
        { session }
      );
      await AcademyRecord.create(
        [
          {
            module: 'notification',
            title: 'Course access activated',
            description: `${transaction.course.name} is now available in your student app.`,
            course: transaction.course._id,
            student: student._id,
            audience: 'students',
            status: 'active',
            payload: { type: 'enrollment_activated', enrollmentId: enrollment._id, validUntil },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  try {
    const receiptPdf = createReceiptPdf({
      receiptNumber: transaction.receiptNumber,
      purchaseId: transaction.purchaseId,
      student,
      course: transaction.course,
      transaction,
      enrollment,
    });
    const transactionId = transaction.gatewayReference || transaction.transactionReference || transaction.purchaseId;
    const purchaseEmail = createPurchaseConfirmationEmail({ student, course: transaction.course, transaction, enrollment, temporaryPassword });
    const delivery = await sendEmail({
      to: student.email,
      subject: `Payment successful — ${transaction.course.name} | Lokaraja Career Academy`,
      text: `Dear ${student.name || 'Student'},\n\nThank you for your purchase. Your payment was successful and ${transaction.course.name} is now active.\nTransaction ID: ${transactionId}\nReceipt number: ${transaction.receiptNumber}\n\nप्रिय विद्यार्थी,\nतुमची फी यशस्वीरीत्या प्राप्त झाली आहे. ${transaction.course.name} हा कोर्स आता तुमच्या खात्यात सक्रिय आहे.\nव्यवहार क्रमांक: ${transactionId}\nपावती क्रमांक: ${transaction.receiptNumber}${temporaryPassword ? `\n\nTemporary password: ${temporaryPassword}\nPlease sign in and change it immediately.` : ''}\n\nYour payment receipt is attached. / तुमची पावती जोडलेली आहे.`,
      html: `<p>Dear ${student.name || 'Student'},</p><p>Thank you for your purchase. Your payment was successful and <strong>${transaction.course.name}</strong> is now active.</p><p><strong>Transaction ID:</strong> ${transactionId}<br/><strong>Receipt number:</strong> ${transaction.receiptNumber}</p><hr/><p>प्रिय विद्यार्थी,</p><p>तुमची फी यशस्वीरीत्या प्राप्त झाली आहे. <strong>${transaction.course.name}</strong> हा कोर्स आता तुमच्या खात्यात सक्रिय आहे.</p><p><strong>व्यवहार क्रमांक:</strong> ${transactionId}<br/><strong>पावती क्रमांक:</strong> ${transaction.receiptNumber}</p>${temporaryPassword ? `<hr/><p><strong>Temporary password:</strong> ${temporaryPassword}</p><p>Please sign in and change this password immediately.</p>` : ''}<p>Your payment receipt is attached. / तुमची पावती जोडलेली आहे.</p>`,
      ...purchaseEmail,
      attachments: [
        {
          filename: `${transaction.receiptNumber}.pdf`,
          content: receiptPdf,
          contentType: 'application/pdf',
        },
      ],
    });
    if (!delivery?.skipped) {
      transaction.receiptEmailedAt = new Date();
      transaction.receiptEmailError = undefined;
    } else {
      transaction.receiptEmailError = delivery.reason;
    }
    await transaction.save();
  } catch (error) {
    logger.error(`Receipt email failed for ${transaction.purchaseId}`, error);
    await Transaction.updateOne(
      { _id: transaction._id },
      { $set: { receiptEmailError: String(error.message || 'Receipt email failed') } }
    );
  }
  return apiResponse.success(res, {
    message: 'Payment verified and enrollment activated',
    data: { transaction, enrollment, student, ...(temporaryPassword ? { temporaryPassword } : {}) },
  });
});

const resetStudentPassword = asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!reason)
    throw new AppError(
      'A reason is required to issue a temporary password',
      STATUS_CODES.BAD_REQUEST
    );
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: { $ne: true },
  }).select('+password +authVersion +refreshTokens');
  if (!student) throw new AppError('Student not found', STATUS_CODES.NOT_FOUND);
  const activeEnrollment = await Enrollment.exists({
    student: student._id,
    status: 'active',
    validUntil: { $gte: new Date() },
  });
  if (!activeEnrollment)
    throw new AppError('The student has no active course enrollment', STATUS_CODES.CONFLICT);
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  student.password = await hashPassword(temporaryPassword);
  student.mustChangePassword = true;
  student.authVersion = Number(student.authVersion || 0) + 1;
  student.refreshTokens = [];
  student.updatedBy = req.user._id;
  await student.save();
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'student_temporary_password_issued',
    module: 'students',
    recordId: student._id,
    newValue: { mustChangePassword: true, sessionsRevoked: true },
    reason,
    ipAddress: req.ip,
  });
  return apiResponse.success(res, {
    message: 'Temporary password issued',
    data: { studentId: student._id, email: student.email, temporaryPassword },
  });
});

const studentDetails = asyncHandler(async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });
  if (!student) throw new AppError('Student not found', STATUS_CODES.NOT_FOUND);
  const [enrollments, transactions, devices, attempts] = await Promise.all([
    Enrollment.find({ student: student._id })
      .populate({ path: 'course', populate: { path: 'subjects' } })
      .populate('transaction')
      .sort({ purchaseDate: -1 }),
    Transaction.find({ student: student._id })
      .populate('course paymentAccount')
      .select('+receiptEmailError')
      .sort({ createdAt: -1 }),
    StudentDevice.find({ student: student._id }).sort({ lastSeenAt: -1 }),
    QuestionAttempt.find({ student: student._id })
      .populate('course', 'name')
      .populate('subject', 'name')
      .populate('mockTest', 'originalFilename')
      .sort({ submittedAt: -1 })
      .limit(100),
  ]);
  const now = Date.now();
  const enrollmentData = enrollments.map((enrollment) => ({
    ...enrollment.toObject(),
    status: new Date(enrollment.validUntil).getTime() < now ? 'expired' : enrollment.status,
    remainingDays: Math.max(0, Math.ceil((new Date(enrollment.validUntil).getTime() - now) / 86400000)),
  }));
  return apiResponse.success(res, {
    message: 'Student commerce details fetched',
    data: { student, enrollments: enrollmentData, transactions, devices, attempts },
  });
});

const myStudentProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.STUDENT) {
    throw new AppError('Student access only', STATUS_CODES.FORBIDDEN);
  }
  const [enrollments, transactions, devices] = await Promise.all([
    Enrollment.find({ student: req.user._id })
      .populate({ path: 'course', populate: { path: 'subjects' } })
      .populate('transaction')
      .sort({ purchaseDate: -1 }),
    Transaction.find({ student: req.user._id })
      .populate('course')
      .sort({ createdAt: -1 })
      .select('-paymentAccountSnapshot'),
    StudentDevice.find({ student: req.user._id }).sort({ lastSeenAt: -1 }),
  ]);
  const now = Date.now();
  const enrollmentData = enrollments.map((enrollment) => ({
    ...enrollment.toObject(),
    status: new Date(enrollment.validUntil).getTime() < now ? 'expired' : enrollment.status,
    remainingDays: Math.max(0, Math.ceil((new Date(enrollment.validUntil).getTime() - now) / 86400000)),
  }));
  const activeCourseIds = enrollmentData
    .filter((enrollment) => enrollment.status === 'active' && enrollment.remainingDays > 0)
    .map((enrollment) => enrollment.course?._id || enrollment.course)
    .filter(Boolean);
  // Material may be uploaded for a subject before that subject is attached to
  // a course. Include it when deciding which Android material tabs to show.
  const enrolledSubjectIds = enrollmentData
    .filter((enrollment) => enrollment.status === 'active' && enrollment.remainingDays > 0)
    .flatMap((enrollment) => enrollment.course?.subjects || [])
    .map((subject) => subject?._id || subject)
    .filter(Boolean);
  // Course documents retain subject IDs after an admin deletes a subject.
  // Resolve only active, non-deleted Subject records before advertising any
  // material category to Android.
  const activeSubjectIds = enrolledSubjectIds.length
    ? await Subject.find({
      _id: { $in: enrolledSubjectIds },
      status: 'active',
      isDeleted: { $ne: true },
    }).distinct('_id')
    : [];
  const [fileCategories, subjectMaterialCategories, hasMockTests] = activeCourseIds.length
    ? await Promise.all([
      LearningFile.distinct('category', {
        course: { $in: activeCourseIds },
        subject: { $in: activeSubjectIds },
        status: 'published',
        isDeleted: { $ne: true },
      }),
      activeSubjectIds.length
        ? LearningFile.distinct('category', {
          course: { $exists: false },
          subject: { $in: activeSubjectIds },
          status: 'published',
          isDeleted: { $ne: true },
        })
        : [],
      activeSubjectIds.length
        ? Question.exists({
          course: { $in: activeCourseIds },
          subject: { $in: activeSubjectIds },
          importBatch: { $exists: true, $ne: null },
          status: 'published',
          isDeleted: { $ne: true },
        })
        : false,
    ])
    : [[], [], false];
  const materialCategories = hasMockTests
    ? [...new Set([...fileCategories, ...subjectMaterialCategories, 'mock-test'])]
    : [...new Set([...fileCategories, ...subjectMaterialCategories])];
  return apiResponse.success(res, {
    message: 'Student profile and purchases fetched',
    data: { student: req.user, enrollments: enrollmentData, transactions, devices, materialCategories },
  });
});

const overrideValidity = asyncHandler(async (req, res) => {
  const validFrom = new Date(req.body.validFrom);
  const validUntil = new Date(req.body.validUntil);
  const reason = String(req.body.reason || '').trim();
  if (!reason)
    throw new AppError(
      'A reason is required for manual validity changes',
      STATUS_CODES.BAD_REQUEST
    );
  if (
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validUntil.getTime()) ||
    validUntil < validFrom
  )
    throw new AppError(
      'Valid-until date must be on or after valid-from date',
      STATUS_CODES.BAD_REQUEST
    );
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) throw new AppError('Enrollment not found', STATUS_CODES.NOT_FOUND);
  const previousValue = { validFrom: enrollment.validFrom, validUntil: enrollment.validUntil };
  enrollment.validityHistory.push({
    previousFrom: enrollment.validFrom,
    previousUntil: enrollment.validUntil,
    updatedFrom: validFrom,
    updatedUntil: validUntil,
    reason,
    updatedBy: req.user._id,
  });
  enrollment.validFrom = validFrom;
  enrollment.validUntil = validUntil;
  enrollment.validityMode = 'manual';
  enrollment.status = validUntil >= new Date() ? 'active' : 'expired';
  enrollment.updatedBy = req.user._id;
  await enrollment.save();
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'validity_overridden',
    module: 'enrollments',
    recordId: enrollment._id,
    previousValue,
    newValue: { validFrom, validUntil },
    reason,
    ipAddress: req.ip,
  });
  await AcademyRecord.create({
    module: 'notification',
    title: 'Course validity updated',
    description: `Your course access is valid until ${validUntil.toLocaleDateString('en-IN')}.`,
    course: enrollment.course,
    student: enrollment.student,
    audience: 'students',
    status: 'active',
    payload: { type: 'validity_updated', enrollmentId: enrollment._id, validFrom, validUntil },
  });
  return apiResponse.success(res, { message: 'Course validity updated', data: enrollment });
});

const studentList = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(
    req.query.export === 'true' ? 5000 : 100,
    Math.max(1, Number(req.query.limit || 20))
  );
  const match = { role: ROLES.STUDENT, isDeleted: { $ne: true } };
  const afterLookup = [];
  if (req.query.search) {
    const search = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    afterLookup.push({
      $match: {
        $or: [
          { name: search },
          { email: search },
          { 'profile.mobile': search },
          { 'profile.phone': search },
          { 'devices.uuid': search },
        ],
      },
    });
  }
  const enrollmentMatch = {};
  if (mongoose.isValidObjectId(req.query.course))
    enrollmentMatch.course = new mongoose.Types.ObjectId(req.query.course);
  if (req.query.purchaseFrom || req.query.purchaseTo) {
    enrollmentMatch.purchaseDate = {};
    if (req.query.purchaseFrom)
      enrollmentMatch.purchaseDate.$gte = new Date(req.query.purchaseFrom);
    if (req.query.purchaseTo) {
      const end = new Date(req.query.purchaseTo);
      end.setUTCHours(23, 59, 59, 999);
      enrollmentMatch.purchaseDate.$lte = end;
    }
  }
  if (Object.keys(enrollmentMatch).length)
    afterLookup.push({ $match: { enrollments: { $elemMatch: enrollmentMatch } } });
  if (req.query.status === 'no-purchase') afterLookup.push({ $match: { purchasedCourseCount: 0 } });
  else if (req.query.status === 'blocked') afterLookup.push({ $match: { isActive: false } });
  else if (req.query.status)
    afterLookup.push({ $match: { 'latestEnrollment.status': req.query.status } });
  const sort =
    req.query.sort === 'name'
      ? { name: 1 }
      : req.query.sort === 'validity'
        ? { 'latestEnrollment.validUntil': 1 }
        : { createdAt: -1 };
  const [result] = await User.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'enrollments',
        localField: '_id',
        foreignField: 'student',
        as: 'enrollments',
      },
    },
    {
      $lookup: {
        from: 'transactions',
        localField: '_id',
        foreignField: 'student',
        as: 'transactions',
      },
    },
    {
      $lookup: {
        from: 'studentdevices',
        localField: '_id',
        foreignField: 'student',
        as: 'devices',
      },
    },
    {
      $addFields: {
        purchasedCourseCount: { $size: '$enrollments' },
        latestEnrollment: {
          $arrayElemAt: [
            { $sortArray: { input: '$enrollments', sortBy: { purchaseDate: -1 } } },
            0,
          ],
        },
        latestTransaction: {
          $arrayElemAt: [{ $sortArray: { input: '$transactions', sortBy: { createdAt: -1 } } }, 0],
        },
        deviceUuid: { $arrayElemAt: ['$devices.uuid', 0] },
      },
    },
    ...afterLookup,
    { $sort: sort },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              password: 0,
              refreshTokens: 0,
              transactions: 0,
              enrollments: 0,
              devices: 0,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const total = result?.total?.[0]?.count || 0;
  const listedStudents = result?.items || [];
  const enrollments = listedStudents.length
    ? await Enrollment.find({ student: { $in: listedStudents.map((item) => item._id) } })
      .populate('course', 'name courseCode')
      .populate('transaction', 'paymentMethod paymentDate pricing.paidAmount status')
      .sort({ purchaseDate: -1 })
    : [];
  const purchasesByStudent = new Map();
  enrollments.forEach((enrollment) => {
    const studentId = String(enrollment.student);
    const values = purchasesByStudent.get(studentId) || [];
    values.push({
      course: enrollment.course?.name || 'Course unavailable',
      courseCode: enrollment.course?.courseCode || '',
      paymentMethod: enrollment.transaction?.paymentMethod || 'Manual payment',
      paidAmount: enrollment.transaction?.pricing?.paidAmount || 0,
      purchaseDate: enrollment.purchaseDate,
      status: enrollment.status,
      validFrom: enrollment.validFrom,
      validUntil: enrollment.validUntil,
    });
    purchasesByStudent.set(studentId, values);
  });
  const now = Date.now();
  const data = listedStudents.map((student) => {
    const latestEnrollment = student.latestEnrollment
      ? {
          ...student.latestEnrollment,
          status: new Date(student.latestEnrollment.validUntil).getTime() < now ? 'expired' : student.latestEnrollment.status,
          remainingDays: Math.max(0, Math.ceil((new Date(student.latestEnrollment.validUntil).getTime() - now) / 86400000)),
        }
      : null;
    const purchasedCourses = (purchasesByStudent.get(String(student._id)) || []).map((purchase) => ({
      ...purchase,
      status: new Date(purchase.validUntil).getTime() < now ? 'expired' : purchase.status,
      validFrom: purchase.validFrom,
      validUntil: purchase.validUntil,
      remainingDays: Math.max(0, Math.ceil((new Date(purchase.validUntil).getTime() - now) / 86400000)),
    }));
    return { ...student, latestEnrollment, purchasedCourses };
  });
  return apiResponse.success(res, {
    message: 'Students fetched',
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

module.exports = {
  requestCourseOtp,
  verifyCourseOtp,
  createPurchase,
  manuallyEnrollStudent,
  listPurchases,
  coursePaymentOptions,
  verifyPurchase,
  studentList,
  studentDetails,
  myStudentProfile,
  overrideValidity,
  resetStudentPassword,
  normalizeValidity,
  buildPricingSnapshot,
};
