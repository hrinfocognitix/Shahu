const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const AcademyRecord = require('../models/AcademyRecord');
const { ROLES } = require('../constants/roles');

const dashboard = asyncHandler(async (req, res) => {
  const [downloads, activeTeachers, activeCourses, activeStudents, activeSubjects, onlineExams, notifications, results, revenue] = await Promise.all([
    AcademyRecord.countDocuments({ module: 'report', status: 'active' }),
    User.countDocuments({ role: ROLES.TEACHER, isActive: true, isDeleted: { $ne: true } }),
    Course.countDocuments({ status: 'active', isDeleted: { $ne: true } }),
    User.countDocuments({ role: ROLES.STUDENT, isActive: true, isDeleted: { $ne: true } }),
    Subject.countDocuments({ status: 'active', isDeleted: { $ne: true } }),
    Exam.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
    AcademyRecord.countDocuments({ module: 'notification', isDeleted: { $ne: true } }),
    AcademyRecord.countDocuments({ module: 'result', isDeleted: { $ne: true } }),
    AcademyRecord.aggregate([
      { $match: { module: 'payment', isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$payload.amount', 0] } } } }
    ])
  ]);

  const totalRevenue = revenue[0]?.total || 0;

  return apiResponse.success(res, {
    message: 'App dashboard fetched',
    data: {
      metrics: {
        downloads,
        activeTeachers,
        activeCourses,
        activeStudents,
        activeSubjects,
        onlineExams,
        notifications,
        results,
        revenue: totalRevenue
      },
      snapshot: {
        runningCourses: activeCourses,
        upcomingExams: onlineExams,
        todayClasses: 0,
        recentAdmissions: await AcademyRecord.countDocuments({ module: 'admission', isDeleted: { $ne: true } }),
        feesCollection: totalRevenue,
        passPercentage: 0,
        attendance: 0
      }
    }
  });
});

const catalog = asyncHandler(async (req, res) => {
  const [courses, subjects, teachers, students, slides, achievements, exams, notifications, results, reports, deletedRecords] = await Promise.all([
    Course.find({ status: 'active', isDeleted: { $ne: true } }).populate('subjects instructor').sort({ createdAt: -1 }).limit(100),
    Subject.find({ status: 'active', isDeleted: { $ne: true } }).populate('courses teacher').sort({ createdAt: -1 }).limit(100),
    User.find({ role: ROLES.TEACHER, isActive: true, isDeleted: { $ne: true } }).select('name email profile role').sort({ createdAt: -1 }).limit(100),
    User.find({ role: ROLES.STUDENT, isActive: true, isDeleted: { $ne: true } }).select('name email profile role').sort({ createdAt: -1 }).limit(100),
    Content.find({ type: 'slide', status: 'published', isDeleted: { $ne: true } }).populate('course subject uploadedBy').sort({ displayOrder: 1, createdAt: -1 }).limit(100),
    Content.find({ type: { $in: ['achievement', 'gallery'] }, status: 'published', isDeleted: { $ne: true } }).populate('uploadedBy').sort({ displayOrder: 1, createdAt: -1 }).limit(100),
    Exam.find({ status: 'published', isDeleted: { $ne: true } }).populate('course subject createdBy').sort({ createdAt: -1 }).limit(100),
    AcademyRecord.find({ module: 'notification', isDeleted: { $ne: true } }).populate('createdBy course subject').sort({ createdAt: -1 }).limit(100),
    AcademyRecord.find({ module: 'result', isDeleted: { $ne: true } }).populate('student course subject createdBy').sort({ createdAt: -1 }).limit(100),
    AcademyRecord.find({ module: 'report', isDeleted: { $ne: true } }).populate('createdBy').sort({ createdAt: -1 }).limit(100),
    AcademyRecord.find({ isDeleted: true }).populate('deletedBy restoredBy').sort({ deletedAt: -1 }).limit(100)
  ]);

  return apiResponse.success(res, {
    message: 'App catalog fetched',
    data: { courses, subjects, teachers, students, slides, achievements, exams, notifications, results, reports, deletedRecords }
  });
});

module.exports = { dashboard, catalog };
