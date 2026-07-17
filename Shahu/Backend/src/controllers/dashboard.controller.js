const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const Attendance = require('../models/Attendance');
const { ROLES } = require('../constants/roles');

const statistics = asyncHandler(async (req, res) => {
  const [students, teachers, courses, subjects, materials, videos, exams, attendance] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
    User.countDocuments({ role: ROLES.TEACHER, isActive: true }),
    Course.countDocuments({ status: 'active' }),
    Subject.countDocuments({ status: 'active' }),
    Content.countDocuments({ type: { $in: ['material', 'note', 'question-paper'] }, status: 'published' }),
    Content.countDocuments({ type: 'video', status: 'published' }),
    Exam.countDocuments({ status: 'published' }),
    Attendance.countDocuments()
  ]);
  return apiResponse.success(res, { message: 'Dashboard statistics fetched', data: { students, teachers, courses, subjects, materials, videos, exams, attendance } });
});

module.exports = { statistics };
