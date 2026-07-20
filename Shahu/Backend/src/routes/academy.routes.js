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
  'lastUpdatedReason',
  'lastDeletedReason',
  'updateReason',
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
const createCoursePayload = (request) => ({
  ...request.body,
  createdBy: request.user._id,
  updatedBy: request.user._id,
  actionHistory: [buildCourseAuditEntry(request, 'created', 'Course created')],
});
const updateCoursePayload = async (request) => {
  const reason = requireReason(
    request.body.updateReason,
    'Update reason is required for course changes'
  );
  if (Array.isArray(request.body.subjects)) {
    const existing = await Course.findById(request.params.id).select('subjects');
    if (!existing) throw new AppError('Course not found', STATUS_CODES.NOT_FOUND);
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
  return {
    ...buildCoursePayload(request),
    lastUpdatedReason: reason,
    $push: { actionHistory: buildCourseAuditEntry(request, 'updated', reason) },
  };
};
const removeCoursePayload = async (request) => {
  const reason = requireReason(
    request.body.deleteReason || request.query.deleteReason,
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
        beforeList: studentCourseFilter,
        canRead: canReadStudentCourse,
        beforeCreate: async (req) => ({ ...(await teacherCanPublish(req)), type: 'video' }),
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
        populate: 'createdBy course subject',
        defaultFilter: { module: 'notification' },
        beforeList: studentNotificationFilter,
        canRead: canReadNotification,
        beforeCreate: (req) => ({ ...req.body, module: 'notification', createdBy: req.user._id }),
      }),
      { writeRoles: teacherRoles }
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
      })
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
      router.get('/:courseId/payment-options', courseCommerceController.coursePaymentOptions);
      router.post('/', courseCommerceController.createPurchase);
      router.use(authenticate);
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
