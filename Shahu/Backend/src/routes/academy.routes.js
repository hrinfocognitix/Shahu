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
const { ROLES } = require('../constants/roles');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const teacherRoles = [ROLES.ADMIN, ROLES.TEACHER];
const courseWriteRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
const owned = request => ({ ...request.body, uploadedBy: request.user._id });
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
const buildCoursePayload = request => ({
  ...Object.fromEntries(
    Object.entries(request.body || {}).filter(([key]) => !['updateReason', 'deleteReason'].includes(key)),
  ),
  updatedBy: request.user._id,
});
const createCoursePayload = request => ({
  ...request.body,
  createdBy: request.user._id,
  updatedBy: request.user._id,
  actionHistory: [buildCourseAuditEntry(request, 'created', 'Course created')],
});
const updateCoursePayload = request => {
  const reason = requireReason(request.body.updateReason, 'Update reason is required for course changes');
  return {
    ...buildCoursePayload(request),
    lastUpdatedReason: reason,
    $push: { actionHistory: buildCourseAuditEntry(request, 'updated', reason) },
  };
};
const removeCoursePayload = request => {
  const reason = requireReason(request.body.deleteReason || request.query.deleteReason, 'Delete reason is required for course deletion');
  return {
    lastDeletedReason: reason,
    $push: { actionHistory: buildCourseAuditEntry(request, 'deleted', reason) },
  };
};
const teacherCanPublish = async request => {
  if (request.user.role === ROLES.ADMIN) return owned(request);
  const subjectId = request.body.subject;
  const assignedSubjects = request.user.profile?.assignedSubjects || request.user.profile?.subjects || [];
  if (!subjectId || !assignedSubjects.some(id => id.toString() === subjectId.toString())) {
    throw new AppError('Teachers can publish only for their assigned subjects', STATUS_CODES.FORBIDDEN);
  }
  return owned(request);
};

module.exports = [
  ['/courses', createResourceRouter(resourceController(Course, { populate: 'subjects', beforeCreate: createCoursePayload, beforeUpdate: updateCoursePayload, beforeRemove: removeCoursePayload }), { publicRead: true, writeRoles: courseWriteRoles })],
  ['/subjects', createResourceRouter(resourceController(Subject, { populate: 'course teacher' }), { publicRead: true })],
  ['/materials', createResourceRouter(resourceController(Content, { populate: 'course subject uploadedBy', defaultFilter: { type: 'material' }, beforeCreate: async req => ({ ...(await teacherCanPublish(req)), type: 'material' }) }), { writeRoles: teacherRoles })],
  ['/slides', createResourceRouter(resourceController(Content, { populate: 'course subject uploadedBy', defaultFilter: { type: 'slide' }, beforeCreate: async req => ({ ...(await teacherCanPublish(req)), type: 'slide' }) }), { writeRoles: teacherRoles })],
  ['/notes', createResourceRouter(resourceController(Content, { populate: 'course subject uploadedBy', defaultFilter: { type: 'note' }, beforeCreate: async req => ({ ...(await teacherCanPublish(req)), type: 'note' }) }), { writeRoles: teacherRoles })],
  ['/question-papers', createResourceRouter(resourceController(Content, { populate: 'course subject uploadedBy', defaultFilter: { type: 'question-paper' }, beforeCreate: async req => ({ ...(await teacherCanPublish(req)), type: 'question-paper' }) }), { writeRoles: teacherRoles })],
  ['/videos', createResourceRouter(resourceController(Content, { populate: 'course subject uploadedBy', defaultFilter: { type: 'video' }, beforeCreate: async req => ({ ...(await teacherCanPublish(req)), type: 'video' }) }), { writeRoles: teacherRoles })],
  ['/gallery', createResourceRouter(resourceController(Content, { populate: 'uploadedBy', defaultFilter: { type: 'gallery', isEnabled: true, sort: 'displayOrder' }, beforeCreate: req => ({ ...owned(req), type: 'gallery' }) }), { publicRead: true })],
  ['/achievements', createResourceRouter(resourceController(Content, { populate: 'uploadedBy', defaultFilter: { type: 'achievement', sort: 'displayOrder' }, beforeCreate: req => ({ ...owned(req), type: 'achievement' }) }), { publicRead: true })],
  ['/announcements', createResourceRouter(resourceController(Announcement, { populate: 'course publishedBy', beforeCreate: req => ({ ...req.body, publishedBy: req.user._id }) }), { publicRead: true, writeRoles: teacherRoles })],
  ['/calendar', createResourceRouter(resourceController(CalendarEvent, { populate: 'course createdBy', beforeCreate: req => ({ ...req.body, createdBy: req.user._id }) }), { publicRead: true, writeRoles: teacherRoles })],
  ['/exams', createResourceRouter(resourceController(Exam, { populate: 'course subject createdBy', beforeCreate: async req => ({ ...(await teacherCanPublish(req)), createdBy: req.user._id }) }), { writeRoles: teacherRoles })],
  ['/attendance', createResourceRouter(resourceController(Attendance, { populate: 'student course subject markedBy', beforeCreate: req => ({ ...req.body, markedBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/syllabus', createResourceRouter(resourceController(AcademyRecord, { populate: 'course subject createdBy', defaultFilter: { module: 'syllabus' }, beforeCreate: req => ({ ...req.body, module: 'syllabus', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/assignments', createResourceRouter(resourceController(AcademyRecord, { populate: 'course subject createdBy', defaultFilter: { module: 'assignment' }, beforeCreate: req => ({ ...req.body, module: 'assignment', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/results', createResourceRouter(resourceController(AcademyRecord, { populate: 'student course subject createdBy', defaultFilter: { module: 'result' }, beforeCreate: req => ({ ...req.body, module: 'result', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/marks', createResourceRouter(resourceController(AcademyRecord, { populate: 'student course subject createdBy', defaultFilter: { module: 'mark' }, beforeCreate: req => ({ ...req.body, module: 'mark', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/notifications', createResourceRouter(resourceController(AcademyRecord, { populate: 'createdBy', defaultFilter: { module: 'notification' }, beforeCreate: req => ({ ...req.body, module: 'notification', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/payments', createResourceRouter(resourceController(AcademyRecord, { populate: 'student course createdBy', defaultFilter: { module: 'payment' }, beforeCreate: req => ({ ...req.body, module: 'payment', createdBy: req.user._id }) }), { writeRoles: [ROLES.ADMIN] })]
  ,['/payment-accounts', createResourceRouter(resourceController(AcademyRecord, { defaultFilter: { module: 'payment-account' }, beforeCreate: req => ({ ...req.body, module: 'payment-account', createdBy: req.user._id }), beforeUpdate: req => ({ ...req.body, module: 'payment-account', updatedBy: req.user._id }) }), { publicRead: true, writeRoles: [ROLES.ADMIN, ROLES.SUPERADMIN] })]
  ,['/settings', createResourceRouter(resourceController(AcademyRecord, { populate: 'createdBy', defaultFilter: { module: 'setting' }, beforeCreate: req => ({ ...req.body, module: 'setting', createdBy: req.user._id }) }))]
  ,['/reports', createResourceRouter(resourceController(AcademyRecord, { populate: 'createdBy', defaultFilter: { module: 'report' }, beforeCreate: req => ({ ...req.body, module: 'report', createdBy: req.user._id }) }), { writeRoles: teacherRoles })]
  ,['/course-purchases', (() => {
    const router = express.Router();
    router.post('/', courseCommerceController.createPurchase);
    router.use(authenticate);
    router.get('/', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), courseCommerceController.listPurchases);
    return router;
  })()]
];
