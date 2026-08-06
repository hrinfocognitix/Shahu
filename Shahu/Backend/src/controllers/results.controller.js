const AcademyRecord = require('../models/AcademyRecord');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');

const studentSummaries = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const search = String(req.query.search || '').trim();
  const pipeline = [
    { $match: { module: 'result', isDeleted: { $ne: true }, student: { $ne: null } } },
    { $group: { _id: '$student', attempts: { $sum: 1 }, totalScore: { $sum: { $ifNull: ['$score', 0] } }, totalMaximum: { $sum: { $ifNull: ['$maximumScore', 0] } }, latestAttemptAt: { $max: '$createdAt' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $match: { 'student.isDeleted': { $ne: true }, ...(search ? { $or: [{ 'student.name': new RegExp(search, 'i') }, { 'student.email': new RegExp(search, 'i') }, { 'student.profile.mobile': new RegExp(search, 'i') }] } : {}) } },
    { $project: { _id: 0, student: { _id: '$student._id', name: '$student.name', email: '$student.email', mobile: '$student.profile.mobile', photo: '$student.profile.photo' }, attempts: 1, totalScore: 1, totalMaximum: 1, latestAttemptAt: 1, percentage: { $cond: [{ $gt: ['$totalMaximum', 0] }, { $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMaximum'] }, 100] }, 1] }, 0] } } },
    { $sort: { latestAttemptAt: -1 } },
  ];
  const [items, totalRows] = await Promise.all([
    AcademyRecord.aggregate([...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }]),
    AcademyRecord.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = totalRows[0]?.total || 0;
  return apiResponse.success(res, { message: 'Student result summaries fetched', data: items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

const studentResultDetails = asyncHandler(async (req, res) => {
  const items = await AcademyRecord.find({ module: 'result', student: req.params.studentId, isDeleted: { $ne: true } })
    .populate('student', 'name email profile.mobile profile.photo')
    .populate('course', 'name courseCode')
    .populate('subject', 'name subjectCode')
    .sort({ createdAt: 1 })
    .limit(1000);
  return apiResponse.success(res, { message: 'Student result details fetched', data: items });
});

module.exports = { studentSummaries, studentResultDetails };
