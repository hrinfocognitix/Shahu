const Course = require('../models/Course');
const AcademyRecord = require('../models/AcademyRecord');
const Transaction = require('../models/Transaction');
const Enrollment = require('../models/Enrollment');
const StudentDevice = require('../models/StudentDevice');
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
const logger = require('../config/logger');

const createPurchaseId = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PUR-${day}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
};

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
  if (String(req.get('X-Client-Platform') || '').toLowerCase() !== 'android') {
    throw new AppError(
      'Course purchases can be submitted only through the Android application',
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
    return {
      _id: item._id,
      title: item.title,
      description: item.description,
      isPrimary:
        String(course.primaryPaymentAccount?._id || course.primaryPaymentAccount) ===
        String(item._id),
      payload: {
        accountType: payload.accountType,
        bankName: payload.bankName,
        accountName: payload.accountName || payload.accountHolder,
        accountNo: payload.accountNo || payload.accountNumber,
        ifsc: payload.ifsc,
        upiId: payload.upiId,
        mobileNo: payload.mobileNo,
        qrCode: payload.qrCode,
        gatewayName: payload.gatewayName,
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
  const purchaseDate = transaction.paymentDate || new Date();
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
        { upsert: true, new: true, runValidators: true, session }
      );
      if (transaction.buyer.deviceUuid)
        await StudentDevice.findOneAndUpdate(
          { uuid: transaction.buyer.deviceUuid },
          {
            $set: { student: student._id, lastSeenAt: new Date(), isActive: true },
            $setOnInsert: { firstSeenAt: new Date(), platform: 'android' },
          },
          { upsert: true, new: true, session }
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
    const delivery = await sendEmail({
      to: student.email,
      subject: `${transaction.course.name} purchase receipt`,
      text: `Your course is active. Purchase tracking ID: ${transaction.purchaseId}. Receipt: ${transaction.receiptNumber}.`,
      html: `<p>Your <strong>${transaction.course.name}</strong> course is active.</p><p>Purchase tracking ID: <strong>${transaction.purchaseId}</strong></p><p>Your payment and course-validity receipt is attached as a PDF.</p>`,
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
  const [enrollments, transactions, devices] = await Promise.all([
    Enrollment.find({ student: student._id })
      .populate({ path: 'course', populate: { path: 'subjects' } })
      .populate('transaction')
      .sort({ purchaseDate: -1 }),
    Transaction.find({ student: student._id })
      .populate('course paymentAccount')
      .sort({ createdAt: -1 }),
    StudentDevice.find({ student: student._id }).sort({ lastSeenAt: -1 }),
  ]);
  return apiResponse.success(res, {
    message: 'Student commerce details fetched',
    data: { student, enrollments, transactions, devices },
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
  return apiResponse.success(res, {
    message: 'Student profile and purchases fetched',
    data: { student: req.user, enrollments, transactions, devices },
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
  return apiResponse.success(res, {
    message: 'Students fetched',
    data: result?.items || [],
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

module.exports = {
  createPurchase,
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
