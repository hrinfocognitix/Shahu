const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const AcademyRecord = require('../models/AcademyRecord');
const { ROLES } = require('../constants/roles');

const compareVersions = (left = '', right = '') => {
  const leftParts = String(left).split('.').map(value => Number.parseInt(value, 10) || 0);
  const rightParts = String(right).split('.').map(value => Number.parseInt(value, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    if ((leftParts[index] || 0) !== (rightParts[index] || 0)) {
      return (leftParts[index] || 0) > (rightParts[index] || 0) ? 1 : -1;
    }
  }
  return 0;
};

const androidUpdate = asyncHandler(async (req, res) => {
  const installedVersion = String(req.query.version || '0').trim();
  const latestVersion = env.mobileUpdate.androidLatestVersion;
  const minimumVersion = env.mobileUpdate.androidMinimumVersion;
  const updateAvailable = compareVersions(installedVersion, latestVersion) < 0;
  const required = Boolean(minimumVersion) && compareVersions(installedVersion, minimumVersion) < 0;

  return apiResponse.success(res, {
    message: 'Android update status fetched',
    data: {
      updateAvailable,
      required,
      latestVersion,
      releaseNotes: env.mobileUpdate.androidReleaseNotes,
      updateUrl: env.mobileUpdate.androidUpdateUrl,
    },
  });
});

const dashboard = asyncHandler(async (req, res) => {
  const [
    downloads,
    activeTeachers,
    activeCourses,
    activeStudents,
    activeSubjects,
    onlineExams,
    notifications,
    results,
    revenue,
  ] = await Promise.all([
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
      { $group: { _id: null, total: { $sum: { $ifNull: ['$payload.amount', 0] } } } },
    ]),
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
        revenue: totalRevenue,
      },
      snapshot: {
        runningCourses: activeCourses,
        upcomingExams: onlineExams,
        todayClasses: 0,
        recentAdmissions: await AcademyRecord.countDocuments({
          module: 'admission',
          isDeleted: { $ne: true },
        }),
        feesCollection: totalRevenue,
        passPercentage: 0,
        attendance: 0,
      },
    },
  });
});

const catalog = asyncHandler(async (req, res) => {
  const [
    courses,
    subjects,
    teachers,
    students,
    slides,
    achievements,
    exams,
    notifications,
    results,
    reports,
    deletedRecords,
  ] = await Promise.all([
    // Legacy courses have no isPublished field and remain visible. Newly
    // created courses require the explicit Publish Course action.
    Course.find({
      status: 'active',
      isDeleted: { $ne: true },
      $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
    })
      .populate('subjects instructor subjectDetails.subject')
      .sort({ createdAt: -1 })
      .limit(100),
    Subject.find({ status: 'active', isDeleted: { $ne: true } })
      .populate('courses teacher')
      .sort({ createdAt: -1 })
      .limit(100),
    User.find({ role: ROLES.TEACHER, isActive: true, isDeleted: { $ne: true } })
      .select(
        'name profile.qualification profile.experience profile.specialization profile.biography profile.assignedSubjects role'
      )
      .sort({ createdAt: -1 })
      .limit(100),
    Promise.resolve([]),
    Content.find({ type: 'slide', status: 'published', isDeleted: { $ne: true } })
      .populate('course subject uploadedBy')
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(100),
    Content.find({
      type: { $in: ['achievement', 'gallery'] },
      status: 'published',
      isDeleted: { $ne: true },
    })
      .populate('uploadedBy')
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(100),
    Exam.find({ status: 'published', isDeleted: { $ne: true } })
      .populate('course subject createdBy')
      .sort({ createdAt: -1 })
      .limit(100),
    AcademyRecord.find({
      module: 'notification',
      audience: { $in: ['all', 'students'] },
      status: 'active',
      isDeleted: { $ne: true },
      student: null,
    })
      .select('title description course subject status scheduledAt audience createdAt')
      .populate('course subject')
      .sort({ createdAt: -1 })
      .limit(100),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
  ]);

  return apiResponse.success(res, {
    message: 'App catalog fetched',
    data: {
      courses,
      subjects,
      teachers,
      students,
      slides,
      achievements,
      exams,
      notifications,
      results,
      reports,
      deletedRecords,
    },
  });
});

module.exports = { dashboard, catalog, androidUpdate };
