const Course = require('../models/Course');
const AcademyRecord = require('../models/AcademyRecord');
const { ROLES } = require('../constants/roles');
const { STATUS_CODES } = require('../constants/statusCodes');
const apiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');

function normalizeValidity(course, paymentDate) {
  const days = Number(course.durationDays || 0);
  if (!days) return null;

  const start = new Date(paymentDate || Date.now());
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return {
    durationDays: days,
    startDate: start,
    endDate: end
  };
}

const createPurchase = asyncHandler(async (req, res) => {
  const {
    courseId,
    paymentAccountId,
    name,
    age,
    address,
    mobileNo,
    transactionId,
    paymentMethod,
    paymentDate,
    amount,
    note
  } = req.body || {};

  if (!courseId || !name || !age || !address || !mobileNo || !transactionId || !paymentMethod) {
    throw new AppError('Course, student details, transaction ID, and payment method are required', STATUS_CODES.BAD_REQUEST);
  }

  const [course, paymentAccount] = await Promise.all([
    Course.findById(courseId).select('_id name fees duration durationDays'),
    paymentAccountId ? AcademyRecord.findOne({ _id: paymentAccountId, module: 'payment-account', isDeleted: { $ne: true } }) : null
  ]);

  if (!course) {
    throw new AppError('Course not found', STATUS_CODES.NOT_FOUND);
  }

  const validity = normalizeValidity(course, paymentDate);
  const record = await AcademyRecord.create({
    module: 'course-purchase',
    title: `${course.name} purchase`,
    description: `${name} submitted a course purchase request`,
    course: course._id,
    status: 'pending-verification',
    payload: {
      studentName: String(name).trim(),
      age: Number(age),
      address: String(address).trim(),
      mobileNo: String(mobileNo).trim(),
      transactionId: String(transactionId).trim(),
      paymentMethod: String(paymentMethod).trim(),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount: Number(amount || course.fees || 0),
      note: String(note || '').trim(),
      courseName: course.name,
      paymentAccountId: paymentAccount?._id || null,
      paymentAccount: paymentAccount?.payload || null,
      validity
    }
  });

  return apiResponse.success(res, {
    statusCode: 201,
    message: 'Course purchase submitted',
    data: record
  });
});

const listPurchases = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user?.role)) {
    throw new AppError('You are not allowed to view course purchases', STATUS_CODES.FORBIDDEN);
  }

  const filter = { module: 'course-purchase', isDeleted: { $ne: true } };
  if (req.query.course) filter.course = req.query.course;

  const items = await AcademyRecord.find(filter).populate('course').sort({ createdAt: -1 });
  return apiResponse.success(res, { message: 'Course purchases fetched', data: items });
});

module.exports = { createPurchase, listPurchases };
