const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const Transaction = require('../models/Transaction');
const Enrollment = require('../models/Enrollment');
const AppInstallation = require('../models/AppInstallation');
const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const paidAmountMinorExpression = {
  $ifNull: [
    '$pricing.paidAmountMinor',
    { $round: [{ $multiply: [{ $ifNull: ['$pricing.paidAmount', 0] }, 100] }, 0] },
  ],
};
const originalPriceMinorExpression = {
  $ifNull: [
    '$pricing.originalPriceMinor',
    { $round: [{ $multiply: [{ $ifNull: ['$pricing.originalPrice', 0] }, 100] }, 0] },
  ],
};

const statistics = asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);
  const [
    students,
    teachers,
    courses,
    subjects,
    materials,
    videos,
    exams,
    attendance,
    pendingPurchases,
    activeEnrollments,
    upcomingExpirations,
    successfulTotals,
    recentPurchases,
    appInstallations,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
    User.countDocuments({ role: ROLES.TEACHER, isActive: true }),
    Course.countDocuments({ status: 'active' }),
    Subject.countDocuments({ status: 'active' }),
    Content.countDocuments({
      type: { $in: ['material', 'note', 'question-paper'] },
      status: 'published',
    }),
    Content.countDocuments({ type: 'video', status: 'published' }),
    Exam.countDocuments({ status: 'published' }),
    Attendance.countDocuments(),
    Transaction.countDocuments({ status: 'pending' }),
    Enrollment.countDocuments({
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }),
    Enrollment.find({
      status: 'active',
      validUntil: { $gte: now, $lte: sevenDaysFromNow },
    })
      .populate('student', 'name email')
      .populate('course', 'name')
      .sort({ validUntil: 1 })
      .limit(6),
    Transaction.aggregate([
      { $match: { status: 'successful' } },
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          revenueMinor: {
            $sum: {
              $ifNull: [
                '$pricing.paidAmountMinor',
                { $multiply: [{ $ifNull: ['$pricing.paidAmount', 0] }, 100] },
              ],
            },
          },
        },
      },
    ]),
    Transaction.find()
      .populate('course', 'name')
      .sort({ createdAt: -1 })
      .limit(6)
      .select('buyer course pricing status paymentDate transactionReference'),
    AppInstallation.countDocuments(),
  ]);
  return apiResponse.success(res, {
    message: 'Dashboard statistics fetched',
    data: {
      students,
      teachers,
      courses,
      subjects,
      materials,
      videos,
      exams,
      attendance,
      pendingPurchases,
      activeEnrollments,
      upcomingExpirations,
      verifiedPurchases: successfulTotals[0]?.purchases || 0,
      revenue: (successfulTotals[0]?.revenueMinor || 0) / 100,
      recentPurchases,
      appInstallations,
    },
  });
});

const purchaseAnalytics = asyncHandler(async (req, res) => {
  const period = ['week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month';
  const requestedTo = req.query.to ? new Date(req.query.to) : new Date();
  const now = Number.isNaN(requestedTo.getTime()) ? new Date() : requestedTo;
  if (req.query.to) now.setUTCHours(23, 59, 59, 999);
  const start = req.query.from ? new Date(req.query.from) : new Date(now);
  if (Number.isNaN(start.getTime()) || start > now) {
    return apiResponse.error(res, { statusCode: 400, message: 'Enter a valid date range' });
  }
  let dateFormat = '%d %b';
  if (!req.query.from && period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (!req.query.from && period === 'month') start.setUTCDate(start.getUTCDate() - 29);
  if (!req.query.from && period === 'year') {
    start.setUTCMonth(start.getUTCMonth() - 11, 1);
    dateFormat = '%b %Y';
  }
  start.setUTCHours(0, 0, 0, 0);
  const allowedStatuses = ['successful', 'pending', 'failed', 'cancelled', 'refunded'];
  const selectedStatus = allowedStatuses.includes(req.query.status)
    ? req.query.status
    : 'successful';
  const baseMatch = { paymentDate: { $gte: start, $lte: now } };
  if (mongoose.isValidObjectId(req.query.course))
    baseMatch.course = new mongoose.Types.ObjectId(req.query.course);
  if (mongoose.isValidObjectId(req.query.paymentAccount))
    baseMatch.paymentAccount = new mongoose.Types.ObjectId(req.query.paymentAccount);
  if (req.query.student) {
    const search = String(req.query.student).trim();
    baseMatch.$or = [
      { 'buyer.email': new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { 'buyer.mobileNo': new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { 'buyer.name': new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ];
  }
  const match = { ...baseMatch, status: selectedStatus };
  const [series, courses, totals, statusCounts, paymentAccounts, enrollmentCounts] =
    await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: '$paymentDate',
                unit: period === 'year' ? 'month' : 'day',
                timezone: 'Asia/Kolkata',
              },
            },
            purchases: { $sum: 1 },
            revenueMinor: { $sum: paidAmountMinorExpression },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            label: {
              $dateToString: { date: '$_id', format: dateFormat, timezone: 'Asia/Kolkata' },
            },
            purchases: 1,
            revenue: { $divide: ['$revenueMinor', 100] },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$course',
            purchases: { $sum: 1 },
            revenueMinor: { $sum: paidAmountMinorExpression },
          },
        },
        { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
        { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            courseId: '$_id',
            courseName: { $ifNull: ['$course.name', 'Deleted course'] },
            purchases: 1,
            revenue: { $divide: ['$revenueMinor', 100] },
          },
        },
        { $sort: { purchases: -1, courseName: 1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            purchases: { $sum: 1 },
            revenueMinor: { $sum: paidAmountMinorExpression },
            averageOrderMinor: { $avg: paidAmountMinorExpression },
            discountGivenMinor: {
              $sum: {
                $cond: [
                  {
                    $gt: [originalPriceMinorExpression, paidAmountMinorExpression],
                  },
                  { $subtract: [originalPriceMinorExpression, paidAmountMinorExpression] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentAccount',
            purchases: { $sum: 1 },
            revenueMinor: { $sum: paidAmountMinorExpression },
          },
        },
        {
          $lookup: {
            from: 'academyrecords',
            localField: '_id',
            foreignField: '_id',
            as: 'account',
          },
        },
        { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            paymentAccountId: '$_id',
            accountName: { $ifNull: ['$account.title', 'Unassigned'] },
            purchases: 1,
            revenue: { $divide: ['$revenueMinor', 100] },
          },
        },
        { $sort: { purchases: -1 } },
      ]),
      Enrollment.aggregate([
        {
          $match: {
            ...(baseMatch.course ? { course: baseMatch.course } : {}),
            validFrom: { $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $and: [{ $eq: ['$status', 'active'] }, { $gte: ['$validUntil', now] }] },
                'active',
                'expired',
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
    ]);
  const total = totals[0]
    ? {
        purchases: totals[0].purchases,
        revenue: Number(totals[0].revenueMinor || 0) / 100,
        averageOrder: Number(totals[0].averageOrderMinor || 0) / 100,
        discountGiven: Number(totals[0].discountGivenMinor || 0) / 100,
      }
    : { purchases: 0, revenue: 0, averageOrder: 0, discountGiven: 0 };
  return apiResponse.success(res, {
    message: 'Purchase analytics fetched',
    data: {
      period,
      range: { from: start, to: now },
      totals: total,
      series,
      courses,
      statusCounts,
      paymentAccounts,
      enrollmentCounts,
    },
  });
});

module.exports = { statistics, purchaseAnalytics };
