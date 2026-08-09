const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const { uploadDir } = require('../config/storage');

const Course = require('../models/Course');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Enrollment = require('../models/Enrollment');
const LearningFile = require('../models/LearningFile');
const SyllabusUnit = require('../models/SyllabusUnit');
const Question = require('../models/Question');
const QuestionAttempt = require('../models/QuestionAttempt');
const QuestionImport = require('../models/QuestionImport');
const QuestionImportRow = require('../models/QuestionImportRow');
const Transaction = require('../models/Transaction');
const PaymentIntent = require('../models/PaymentIntent');
const CoursePurchaseOtp = require('../models/CoursePurchaseOtp');
const EmailVerificationOtp = require('../models/EmailVerificationOtp');
const LoginOtp = require('../models/LoginOtp');
const AcademyRecord = require('../models/AcademyRecord');
const Content = require('../models/Content');
const Announcement = require('../models/Announcement');
const Attendance = require('../models/Attendance');
const CalendarEvent = require('../models/CalendarEvent');
const Exam = require('../models/Exam');
const SplashScreen = require('../models/SplashScreen');
const AppInstallation = require('../models/AppInstallation');
const StudentDevice = require('../models/StudentDevice');
const AuditLog = require('../models/AuditLog');

const models = [
  Course, User, Subject, Enrollment, LearningFile, SyllabusUnit, Question, QuestionAttempt,
  QuestionImport, QuestionImportRow, Transaction, PaymentIntent, CoursePurchaseOtp,
  EmailVerificationOtp, LoginOtp, AcademyRecord, Content, Announcement, Attendance,
  CalendarEvent, Exam, SplashScreen, AppInstallation, StudentDevice, AuditLog,
];

const bytes = (value = 0) => {
  const size = Number(value) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(2)} MB`;
  return `${(size / 1024 ** 3).toFixed(2)} GB`;
};

const deleteKnownUploadFiles = async (files) => {
  await Promise.all(files.map(async (file) => {
    if (!file.storedFilename) return;
    const target = path.join(uploadDir, path.basename(file.storedFilename));
    try { await fs.unlink(target); } catch (error) { if (error.code !== 'ENOENT') logger.warn('Unable to remove learning upload during system cleanup', { file: file.storedFilename, error: error.message }); }
  }));
};

const dataSummary = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const [database, courses, students, teachers, learningFiles, enrollments, collections] = await Promise.all([
    db.stats(),
    Course.countDocuments(), User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'teacher' }),
    LearningFile.countDocuments(), Enrollment.countDocuments(), db.listCollections({}, { nameOnly: true }).toArray(),
  ]);
  const collectionUsage = await Promise.all(collections.map(async ({ name }) => {
    try {
      const stats = await db.command({ collStats: name });
      return { name, documents: stats.count || 0, sizeBytes: stats.size || 0, storageBytes: stats.storageSize || 0, size: bytes(stats.size), storage: bytes(stats.storageSize) };
    } catch { return { name, documents: 0, sizeBytes: 0, storageBytes: 0, size: '0 B', storage: '0 B' }; }
  }));
  return apiResponse.success(res, {
    message: 'System data usage fetched',
    data: {
      database: { dataBytes: database.dataSize || 0, storageBytes: database.storageSize || 0, indexBytes: database.indexSize || 0, data: bytes(database.dataSize), storage: bytes(database.storageSize), indexes: bytes(database.indexSize) },
      records: { courses, students, teachers, learningFiles, enrollments },
      collections: collectionUsage.sort((a, b) => b.storageBytes - a.storageBytes),
    },
  });
});

const requireConfirmation = (value, expected) => {
  if (String(value || '').trim().replace(/\s+/g, ' ').toUpperCase() !== expected) throw new AppError(`Type ${expected} to confirm this permanent action`, 400);
};

const deleteCourse = asyncHandler(async (req, res) => {
  requireConfirmation(req.body.confirmation, 'DELETE COURSE');
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);
  const files = await LearningFile.find({ course: course._id }).select('storedFilename');
  const imports = await QuestionImport.find({ course: course._id }).select('_id');
  const importIds = imports.map((item) => item._id);
  const subjectIds = (course.subjects || []).map((item) => item._id || item);
  const filter = { course: course._id };
  const results = await Promise.all([
    Enrollment.collection.deleteMany(filter), LearningFile.collection.deleteMany(filter), SyllabusUnit.collection.deleteMany(filter),
    Question.collection.deleteMany(filter), QuestionAttempt.collection.deleteMany(filter), QuestionImport.collection.deleteMany(filter),
    Transaction.collection.deleteMany(filter), PaymentIntent.collection.deleteMany(filter), CoursePurchaseOtp.collection.deleteMany(filter),
    AcademyRecord.collection.deleteMany(filter), Content.collection.deleteMany(filter), Course.collection.deleteOne({ _id: course._id }),
    importIds.length ? QuestionImportRow.collection.deleteMany({ importBatch: { $in: importIds } }) : Promise.resolve({ deletedCount: 0 }),
    User.collection.updateMany({}, { $pull: { 'profile.assignedCourses': course._id, 'profile.purchasedCourses': course._id, 'profile.enrolledSubjects': { $in: subjectIds } } }),
    User.collection.updateMany({ 'profile.enrolledCourse': course._id }, { $unset: { 'profile.enrolledCourse': '' } }),
  ]);
  await deleteKnownUploadFiles(files);
  const deletedCount = results.reduce((total, item) => total + (item.deletedCount || 0), 0);
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'system_course_permanently_deleted', module: 'system-data', recordId: course._id, previousValue: { name: course.name }, ipAddress: req.ip });
  logger.warn('Superadmin permanently deleted a course and dependent data', { requestId: req.requestId, courseId: String(course._id), deletedCount, userId: String(req.user._id) });
  return apiResponse.success(res, { message: 'Course and dependent student learning data permanently deleted', data: { deletedCount } });
});

const deleteStudent = asyncHandler(async (req, res) => {
  requireConfirmation(req.body.confirmation, 'DELETE STUDENT');
  const student = await User.findOne({ _id: req.params.id, role: 'student' });
  if (!student) throw new AppError('Student not found', 404);
  const results = await Promise.all([
    Enrollment.collection.deleteMany({ student: student._id }), QuestionAttempt.collection.deleteMany({ student: student._id }),
    Transaction.collection.deleteMany({ student: student._id }), AcademyRecord.collection.deleteMany({ student: student._id }),
    StudentDevice.collection.deleteMany({ student: student._id }), AppInstallation.collection.deleteMany({ student: student._id }),
    User.collection.deleteOne({ _id: student._id }),
  ]);
  const deletedCount = results.reduce((total, item) => total + (item.deletedCount || 0), 0);
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'system_student_permanently_deleted', module: 'system-data', recordId: student._id, previousValue: { email: student.email }, ipAddress: req.ip });
  logger.warn('Superadmin permanently deleted a student and dependent data', { requestId: req.requestId, studentId: String(student._id), deletedCount, userId: String(req.user._id) });
  return apiResponse.success(res, { message: 'Student and dependent data permanently deleted', data: { deletedCount } });
});

const clearAcademyData = asyncHandler(async (req, res) => {
  requireConfirmation(req.body.confirmation, 'DELETE ALL ACADEMY DATA');
  const files = await LearningFile.find({}).select('storedFilename');
  // Preserve administrator/superadmin access so the portal remains usable after cleanup.
  const protectedUsers = { role: { $in: ['admin', 'superadmin'] } };
  const results = await Promise.all(models.map((Model) => {
    const filter = Model === User ? { ...protectedUsers, _id: { $exists: true } } : {};
    if (Model === User) return Model.collection.deleteMany({ role: { $nin: ['admin', 'superadmin'] } });
    return Model.collection.deleteMany(filter);
  }));
  await deleteKnownUploadFiles(files);
  const deletedCount = results.reduce((total, item) => total + (item.deletedCount || 0), 0);
  await AuditLog.collection.insertOne({ user: req.user._id, role: req.user.role, action: 'system_all_academy_data_cleared', module: 'system-data', newValue: { deletedCount, preserved: 'admin_and_superadmin_accounts' }, ipAddress: req.ip, createdAt: new Date(), updatedAt: new Date() });
  logger.warn('Superadmin cleared all academy data', { requestId: req.requestId, deletedCount, userId: String(req.user._id) });
  return apiResponse.success(res, { message: 'All academy data was permanently deleted. Admin and superadmin accounts were retained.', data: { deletedCount } });
});

module.exports = { dataSummary, deleteCourse, deleteStudent, clearAcademyData };
