const express = require('express');
const resourceController = require('../controllers/resource.controller');
const courseCommerceController = require('../controllers/courseCommerce.controller');
const createResourceRouter = require('./resource.routes');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Content = require('../models/Content');
const Announcement = require('../models/Announcement');
const CalendarEvent = require('../models/CalendarEvent');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const AcademyRecord = require('../models/AcademyRecord');
const Enrollment = require('../models/Enrollment');
const Transaction = require('../models/Transaction');
const SyllabusUnit = require('../models/SyllabusUnit');
const Question = require('../models/Question');
const QuestionAttempt = require('../models/QuestionAttempt');
const { ROLES } = require('../constants/roles');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { isCompleteUpiId, normalizeUpiId } = require('../services/paymentIntent.service');
const { sendNewCoursePush, sendNotificationPush } = require('../services/notification.service');

const teacherRoles = [ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER];
const courseWriteRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
const owned = (request) => ({ ...request.body, uploadedBy: request.user._id });
const studentNotificationFilter = async (request) => {
  if (request.user.role !== ROLES.STUDENT) return {};
  const enrollments = await Enrollment.find({
    student: request.user._id,
    status: 'active',
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).distinct('course');
  return {
    $or: [
      { student: request.user._id },
      {
        student: null,
        audience: { $in: ['all', 'students'] },
        $or: [{ course: null }, { course: { $in: enrollments } }],
      },
    ],
  };
};
const canReadNotification = async (request, item) => {
  if (request.user.role !== ROLES.STUDENT) return true;
  if (String(item.student?._id || item.student || '') === String(request.user._id)) return true;
  if (item.student || !['all', 'students'].includes(item.audience)) return false;
  if (!item.course) return true;
  return Boolean(
    await Enrollment.exists({
      student: request.user._id,
      course: item.course?._id || item.course,
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    })
  );
};
const studentCourseFilter = async (request) => {
  if (request.user.role !== ROLES.STUDENT) return {};
  const courses = await Enrollment.find({
    student: request.user._id,
    status: 'active',
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).distinct('course');
  return { course: { $in: courses } };
};
const canReadStudentCourse = async (request, item) => {
  if (request.user.role !== ROLES.STUDENT) return true;
  return Boolean(
    await Enrollment.exists({
      student: request.user._id,
      course: item.course?._id || item.course,
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    })
  );
};
const validateLiveLecture = (body) => {
  const scheduledAt = new Date(body.scheduledAt);
  if (!body.scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw new AppError('Live lecture date and time must be in the future', STATUS_CODES.BAD_REQUEST);
  }
  return scheduledAt;
};
const publishScheduledLecture = async (video) => {
  const scheduledAt = new Date(video.scheduledAt);
  if (!video.course || Number.isNaN(scheduledAt.getTime())) return;
  const now = new Date();
  const studentIds = await Enrollment.find({
    course: video.course,
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  }).distinct('student');

  await CalendarEvent.create({
    title: `Live lecture: ${video.title}`,
    type: 'live-class',
    startDate: scheduledAt,
    description: video.description || 'Your scheduled live lecture is available in the app at the listed time.',
    course: video.course,
    createdBy: video.uploadedBy,
  });

  await sendNotificationPush({
    title: 'Live lecture scheduled',
    body: `${video.title} is scheduled for ${scheduledAt.toLocaleString('en-IN')}.`,
    students: studentIds,
    data: {
      type: 'scheduled_lecture',
      videoId: video._id,
      courseId: video.course,
      scheduledAt: scheduledAt.toISOString(),
    },
  });
};
const requireReason = (value, message) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError(message, STATUS_CODES.BAD_REQUEST);
  }
  return normalized;
};
const buildCourseAuditEntry = (request, action, reason) => ({
  action,
  reason,
  actedAt: new Date(),
  actedBy: request.user._id,
});
const serverControlledCourseFields = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'deletedBy',
  'restoredAt',
  'restoredBy',
  'isDeleted',
  'actionHistory',
  'priceHistory',
  'lastUpdatedReason',
  'lastDeletedReason',
  'updateReason',
  'statusReason',
  'deleteReason',
]);
const buildCoursePayload = (request) => ({
  ...Object.fromEntries(
    Object.entries(request.body || {}).filter(
      ([key]) => !serverControlledCourseFields.has(key) && !key.startsWith('$')
    )
  ),
  updatedBy: request.user._id,
});
const requireCourseField = (value, message) => {
  if (!String(value || '').trim()) {
    throw new AppError(message, STATUS_CODES.BAD_REQUEST);
  }
};
const parseCurrencyAmount = (value, label) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new AppError(`${label} must use a maximum of two decimal places`, STATUS_CODES.BAD_REQUEST);
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${label} must be a valid amount`, STATUS_CODES.BAD_REQUEST);
  }
  return { amount, display: amount.toFixed(2) };
};
const createCoursePayload = (request) => {
  const { body } = request;

  requireCourseField(body.name, 'Course name is required');
  requireCourseField(body.description, 'Course description is required');

  if (!Number.isFinite(Number(body.durationDays)) || Number(body.durationDays) < 1) {
    throw new AppError('Course validity in days is required', STATUS_CODES.BAD_REQUEST);
  }
  const originalPrice = parseCurrencyAmount(body.actualPrice, 'Original course price');
  if (!Array.isArray(body.subjects) || body.subjects.length === 0) {
    throw new AppError('Select at least one course subject', STATUS_CODES.BAD_REQUEST);
  }
  if (!Array.isArray(body.benefits) || body.benefits.length === 0) {
    throw new AppError('Add at least one course benefit', STATUS_CODES.BAD_REQUEST);
  }
  if (!Array.isArray(body.useCases) || body.useCases.length === 0) {
    throw new AppError('Add at least one course-help item', STATUS_CODES.BAD_REQUEST);
  }

  return {
    ...body,
    actualPrice: originalPrice.amount,
    actualPriceDisplay: originalPrice.display,
    createdBy: request.user._id,
    updatedBy: request.user._id,
    actionHistory: [buildCourseAuditEntry(request, 'created', 'Course created')],
  };
};
const updateCoursePayload = async (request) => {
  let reason = requireReason(
    request.body.updateReason,
    'Update reason is required for course changes'
  );
  const statusWasSubmitted = Object.prototype.hasOwnProperty.call(request.body, 'status');
  const priceWasSubmitted = ['actualPrice', 'discountType', 'discountValue', 'discountPercent'].some(
    (key) => Object.prototype.hasOwnProperty.call(request.body, key)
  );
  let existing;

  if (Array.isArray(request.body.subjects) || statusWasSubmitted || priceWasSubmitted) {
    existing = await Course.findById(request.params.id).select(
      'subjects status actualPrice fees discountType discountValue discountPercent'
    );
    if (!existing) throw new AppError('Course not found', STATUS_CODES.NOT_FOUND);
  }

  if (statusWasSubmitted && request.body.status !== existing.status) {
    const statusReason = requireReason(
      request.body.statusReason,
      'A reason is required to activate or deactivate a course'
    );
    reason = `Course ${request.body.status}: ${statusReason}`;
  }

  if (Array.isArray(request.body.subjects)) {
    const nextSubjects = new Set(request.body.subjects.map(String));
    const removedSubjects = (existing.subjects || []).filter(
      (subject) => !nextSubjects.has(String(subject))
    );
    for (const subject of removedSubjects) {
      const [syllabus, questions, attempts] = await Promise.all([
        SyllabusUnit.exists({ course: existing._id, subject, isDeleted: { $ne: true } }),
        Question.exists({ course: existing._id, subject, isDeleted: { $ne: true } }),
        QuestionAttempt.exists({ course: existing._id, subject }),
      ]);
      if (syllabus || questions || attempts) {
        throw new AppError(
          'This subject cannot be removed because syllabus, questions, or student attempts depend on it. Deactivate related content first.',
          STATUS_CODES.CONFLICT
        );
      }
    }
  }
  const payload = buildCoursePayload(request);
  let priceHistoryEntry;

  if (payload.actualPrice !== undefined) {
    const originalPrice = parseCurrencyAmount(payload.actualPrice, 'Original course price');
    const actualPrice = originalPrice.amount;
    const discountValue = Number(payload.discountValue || payload.discountPercent || 0);
    const discountType = payload.discountType || 'percentage';

    if (!Number.isFinite(actualPrice) || actualPrice < 0) {
      throw new AppError('Original course price must be a valid amount', STATUS_CODES.BAD_REQUEST);
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      throw new AppError('Course discount must be a valid amount', STATUS_CODES.BAD_REQUEST);
    }
    if (discountType === 'percentage' && discountValue > 100) {
      throw new AppError('Percentage discount cannot exceed 100%', STATUS_CODES.BAD_REQUEST);
    }
    if (discountType === 'fixed' && discountValue > actualPrice) {
      throw new AppError('Fixed discount cannot exceed the original price', STATUS_CODES.BAD_REQUEST);
    }

    const payablePrice =
      discountType === 'fixed'
        ? actualPrice - discountValue
        : actualPrice - (actualPrice * discountValue) / 100;

    payload.actualPrice = actualPrice;
    payload.actualPriceDisplay = originalPrice.display;
    payload.discountType = discountType;
    payload.discountValue = discountValue;
    payload.discountPercent =
      discountType === 'percentage'
        ? discountValue
        : actualPrice
          ? Number(((discountValue / actualPrice) * 100).toFixed(2))
          : 0;
    payload.fees = Math.max(0, Number(payablePrice.toFixed(2)));
    payload.price = payload.fees;
    payload.actualPriceMinor = Math.round(actualPrice * 100);
    payload.payablePriceMinor = Math.round(payload.fees * 100);
    payload.discountAmountMinor = Math.max(0, payload.actualPriceMinor - payload.payablePriceMinor);

    if (
      existing &&
      (Number(existing.actualPrice || 0) !== actualPrice ||
        Number(existing.fees || 0) !== payload.fees ||
        String(existing.discountType || 'percentage') !== discountType ||
        Number(existing.discountValue || existing.discountPercent || 0) !== discountValue)
    ) {
      priceHistoryEntry = {
        previousActualPrice: Number(existing.actualPrice || 0),
        updatedActualPrice: actualPrice,
        previousPayablePrice: Number(existing.fees || 0),
        updatedPayablePrice: payload.fees,
        previousDiscountType: existing.discountType || 'percentage',
        updatedDiscountType: discountType,
        previousDiscountValue: Number(existing.discountValue || existing.discountPercent || 0),
        updatedDiscountValue: discountValue,
        reason,
        changedAt: new Date(),
        changedBy: request.user._id,
      };
    }
  }

  return {
    ...payload,
    lastUpdatedReason: reason,
    $push: {
      actionHistory: buildCourseAuditEntry(request, 'updated', reason),
      ...(priceHistoryEntry ? { priceHistory: priceHistoryEntry } : {}),
    },
  };
};
const removeCoursePayload = async (request) => {
    console.log("================================= ID:", request.params.id);
  console.log("================================= Query:", request.query);
  console.log("================================= Body:", request.body);
  const reason = requireReason(
    request.body?.deleteReason || request.query.deleteReason,
    'Delete reason is required for course deletion'
  );
  const activeEnrollment = await Enrollment.exists({
    course: request.params.id,
    status: 'active',
    validUntil: { $gte: new Date() },
  });
  if (activeEnrollment) {
    throw new AppError(
      'This course has active student enrollments. Set the course inactive instead of deleting it.',
      STATUS_CODES.CONFLICT
    );
  }
  return {
    lastDeletedReason: reason,
    $push: { actionHistory: buildCourseAuditEntry(request, 'deleted', reason) },
  };
};
const preventReferencedCoursePermanentDelete = async (request) => {
  const course = request.params.id;
  const [transactions, enrollments, syllabus, questions, attempts] = await Promise.all([
    Transaction.exists({ course }),
    Enrollment.exists({ course }),
    SyllabusUnit.exists({ course }),
    Question.exists({ course }),
    QuestionAttempt.exists({ course }),
  ]);
  if (transactions || enrollments || syllabus || questions || attempts) {
    throw new AppError(
      'Referenced courses cannot be permanently deleted. Keep this course inactive or soft-deleted to preserve history.',
      STATUS_CODES.CONFLICT
    );
  }
};
const teacherCanPublish = async (request) => {
  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(request.user.role)) return owned(request);
  const subjectId = request.body.subject;
  const assignedSubjects =
    request.user.profile?.assignedSubjects || request.user.profile?.subjects || [];
  if (!subjectId || !assignedSubjects.some((id) => id.toString() === subjectId.toString())) {
    throw new AppError(
      'Teachers can publish only for their assigned subjects',
      STATUS_CODES.FORBIDDEN
    );
  }
  return owned(request);
};
const buildPaymentAccount = async (request, creating = false) => {
  const payload = { ...(request.body.payload || {}) };
  const upiId = normalizeUpiId(payload.upiId);
  // A mobile number is contact information, not a VPA. Never persist it as a Pay Now UPI ID.
  if (!isCompleteUpiId(upiId)) {
    throw new AppError(
      'Complete UPI ID is required and must include its @ handle (example: 7030901355@ibl). A mobile number alone cannot be used for Pay Now.',
      STATUS_CODES.BAD_REQUEST
    );
  }
  payload.upiId = upiId;
  payload.paymentMode = payload.paymentMode === 'merchant-gateway' ? 'merchant-gateway' : 'direct-upi';
  payload.merchantType = payload.merchantType === 'business' ? 'business' : 'personal';
  payload.merchantDisplayName = String(payload.merchantDisplayName || payload.accountName || request.body.title || '').trim();
  payload.merchantCategoryCode = String(payload.merchantCategoryCode || '').trim();
  payload.upiHandleProvider = String(payload.upiHandleProvider || upiId.split('@')[1]).trim().toLowerCase();
  payload.supportsGpay = payload.supportsGpay !== false;
  payload.supportsPhonePe = payload.supportsPhonePe !== false;
  payload.supportsBhim = payload.supportsBhim !== false;
  payload.supportsPaytm = payload.supportsPaytm !== false;
  payload.isQrEnabled = Boolean(payload.isQrEnabled);
  payload.qrType = payload.qrType === 'dynamic' ? 'dynamic' : 'static';
  payload.remarks = String(payload.remarks || '').trim();
  payload.instructions = String(payload.instructions || '').trim();
  if (payload.defaultAccount === true) {
    await AcademyRecord.updateMany(
      { module: 'payment-account', _id: { $ne: request.params.id }, isDeleted: { $ne: true } },
      { $set: { 'payload.defaultAccount': false } }
    );
  }
  return {
    ...request.body,
    module: 'payment-account',
    payload,
    [creating ? 'createdBy' : 'updatedBy']: request.user._id,
  };
};

module.exports = [
  [
    '/courses',
    createResourceRouter(
      resourceController(Course, {
        populate: 'subjects subjectDetails.subject',
        beforeCreate: createCoursePayload,
        afterCreate: (course) => sendNewCoursePush(course),
        beforeUpdate: updateCoursePayload,
        beforeRemove: removeCoursePayload,
        beforePermanentRemove: preventReferencedCoursePermanentDelete,
      }),
      { publicRead: true, writeRoles: courseWriteRoles }
    ),
  ],
  [
    '/subjects',
    createResourceRouter(resourceController(Subject, { populate: 'course teacher' }), {
      publicRead: true,
    }),
  ],
  [
    '/materials',
    createResourceRouter(
      resourceController(Content, {
        populate: 'course subject uploadedBy',
        defaultFilter: { type: 'material' },
        beforeCreate: async (req) => ({ ...(await teacherCanPublish(req)), type: 'material' }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/slides',
    createResourceRouter(
      resourceController(Content, {
        populate: 'course subject uploadedBy',
        defaultFilter: { type: 'slide' },
        beforeCreate: async (req) => ({ ...(await teacherCanPublish(req)), type: 'slide' }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/notes',
    createResourceRouter(
      resourceController(Content, {
        populate: 'course subject uploadedBy',
        defaultFilter: { type: 'note' },
        beforeCreate: async (req) => ({ ...(await teacherCanPublish(req)), type: 'note' }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/question-papers',
    createResourceRouter(
      resourceController(Content, {
        populate: 'course subject uploadedBy',
        defaultFilter: { type: 'question-paper' },
        beforeCreate: async (req) => ({
          ...(await teacherCanPublish(req)),
          type: 'question-paper',
        }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/videos',
    createResourceRouter(
      resourceController(Content, {
        populate: 'course subject uploadedBy',
        defaultFilter: { type: 'video' },
        beforeList: async (req) => {
          const courseFilter = await studentCourseFilter(req);
          return req.user.role === ROLES.STUDENT
            ? { ...courseFilter, $or: [{ scheduledAt: null }, { scheduledAt: { $lte: new Date() } }] }
            : courseFilter;
        },
        canRead: canReadStudentCourse,
        beforeCreate: async (req) => {
          validateLiveLecture(req.body);
          return { ...(await teacherCanPublish(req)), type: 'video' };
        },
        afterCreate: publishScheduledLecture,
        beforeUpdate: async (req) => {
          if (Object.prototype.hasOwnProperty.call(req.body, 'scheduledAt')) validateLiveLecture(req.body);
          return { ...req.body, updatedBy: req.user._id };
        },
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/gallery',
    createResourceRouter(
      resourceController(Content, {
        populate: 'uploadedBy',
        defaultFilter: { type: 'gallery', isEnabled: true, sort: 'displayOrder' },
        beforeCreate: (req) => ({ ...owned(req), type: 'gallery' }),
      }),
      { publicRead: true }
    ),
  ],
  [
    '/achievements',
    createResourceRouter(
      resourceController(Content, {
        populate: 'uploadedBy',
        defaultFilter: { type: 'achievement', sort: 'displayOrder' },
        beforeCreate: (req) => ({ ...owned(req), type: 'achievement' }),
      }),
      { publicRead: true, writeRoles: [ROLES.ADMIN, ROLES.SUPERADMIN] }
    ),
  ],
  [
    '/announcements',
    createResourceRouter(
      resourceController(Announcement, {
        populate: 'course publishedBy',
        beforeCreate: (req) => ({ ...req.body, publishedBy: req.user._id }),
      }),
      { publicRead: true, writeRoles: teacherRoles }
    ),
  ],
  [
    '/calendar',
    createResourceRouter(
      resourceController(CalendarEvent, {
        populate: 'course createdBy',
        beforeCreate: (req) => ({ ...req.body, createdBy: req.user._id }),
      }),
      { publicRead: true, writeRoles: teacherRoles }
    ),
  ],
  [
    '/exams',
    createResourceRouter(
      resourceController(Exam, {
        populate: 'course subject createdBy',
        beforeCreate: async (req) => ({
          ...(await teacherCanPublish(req)),
          createdBy: req.user._id,
        }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/attendance',
    createResourceRouter(
      resourceController(Attendance, {
        populate: 'student course subject markedBy',
        beforeCreate: (req) => ({ ...req.body, markedBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/syllabus',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'course subject createdBy',
        defaultFilter: { module: 'syllabus' },
        beforeCreate: (req) => ({ ...req.body, module: 'syllabus', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/assignments',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'course subject createdBy',
        defaultFilter: { module: 'assignment' },
        beforeCreate: (req) => ({ ...req.body, module: 'assignment', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/results',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'student course subject createdBy',
        defaultFilter: { module: 'result' },
        beforeList: (req) => (req.user.role === ROLES.STUDENT ? { student: req.user._id } : {}),
        canRead: (req, item) =>
          req.user.role !== ROLES.STUDENT ||
          String(item.student?._id || item.student) === String(req.user._id),
        beforeCreate: (req) => ({ ...req.body, module: 'result', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/marks',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'student course subject createdBy',
        defaultFilter: { module: 'mark' },
        beforeList: (req) => (req.user.role === ROLES.STUDENT ? { student: req.user._id } : {}),
        canRead: (req, item) =>
          req.user.role !== ROLES.STUDENT ||
          String(item.student?._id || item.student) === String(req.user._id),
        beforeCreate: (req) => ({ ...req.body, module: 'mark', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/notifications',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'student createdBy course subject',
        defaultFilter: { module: 'notification' },
        beforeList: studentNotificationFilter,
        canRead: canReadNotification,
        beforeCreate: (req) => ({ ...req.body, module: 'notification', createdBy: req.user._id }),
        afterCreate: (notification) =>
          sendNotificationPush({
            title: notification.title,
            body: notification.description,
            student: notification.student,
            data: {
              type: 'academy_notification',
              notificationId: notification._id,
              courseId: notification.course || '',
              deepLink: notification.course ? `shahu://course/${notification.course}` : '',
            },
          }),
      }),
      // Staff can archive notifications; only Super Admin can remove any
      // record permanently.
      { writeRoles: teacherRoles, permanentRemoveRoles: [ROLES.SUPERADMIN] }
    ),
  ],
  [
    '/payments',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'student course createdBy',
        defaultFilter: { module: 'payment' },
        beforeList: (req) => (req.user.role === ROLES.STUDENT ? { student: req.user._id } : {}),
        canRead: (req, item) =>
          req.user.role !== ROLES.STUDENT ||
          String(item.student?._id || item.student) === String(req.user._id),
        beforeCreate: (req) => ({ ...req.body, module: 'payment', createdBy: req.user._id }),
      }),
      { writeRoles: [ROLES.ADMIN, ROLES.SUPERADMIN] }
    ),
  ],
  [
    '/payment-accounts',
    createResourceRouter(
      resourceController(AcademyRecord, {
        defaultFilter: { module: 'payment-account' },
        beforeCreate: (req) => buildPaymentAccount(req, true),
        beforeUpdate: (req) => buildPaymentAccount(req, false),
      }),
      { writeRoles: [ROLES.ADMIN, ROLES.SUPERADMIN] }
    ),
  ],
  [
    '/settings',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'createdBy',
        defaultFilter: { module: 'setting' },
        beforeCreate: (req) => ({ ...req.body, module: 'setting', createdBy: req.user._id }),
      }),
      { writeRoles: [ROLES.SUPERADMIN] }
    ),
  ],
  [
    '/reports',
    createResourceRouter(
      resourceController(AcademyRecord, {
        populate: 'createdBy',
        defaultFilter: { module: 'report' },
        beforeCreate: (req) => ({ ...req.body, module: 'report', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
    ),
  ],
  [
    '/course-purchases',
    (() => {
      const router = express.Router();
      router.post('/request-otp', courseCommerceController.requestCourseOtp);
      router.post('/verify-otp', courseCommerceController.verifyCourseOtp);
      router.get('/:courseId/payment-options', courseCommerceController.coursePaymentOptions);
      router.post('/', courseCommerceController.createPurchase);
      router.use(authenticate);
      router.post(
        '/manual',
        authorize(ROLES.SUPERADMIN),
        courseCommerceController.createPurchase
      );
      router.get('/me', authorize(ROLES.STUDENT), courseCommerceController.myStudentProfile);
      router.get(
        '/',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.listPurchases
      );
      router.get(
        '/students',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.studentList
      );
      router.get(
        '/students/:id',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.studentDetails
      );
      router.post(
        '/students/:id/reset-password',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.resetStudentPassword
      );
      router.patch(
        '/transactions/:id/verify',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.verifyPurchase
      );
      router.patch(
        '/enrollments/:id/validity',
        authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
        courseCommerceController.overrideValidity
      );
      return router;
    })(),
  ],
];
