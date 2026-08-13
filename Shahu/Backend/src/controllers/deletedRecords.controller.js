const Course = require('../models/Course');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const AcademyRecord = require('../models/AcademyRecord');
const SyllabusUnit = require('../models/SyllabusUnit');
const LearningFile = require('../models/LearningFile');
const Question = require('../models/Question');
const QuestionImport = require('../models/QuestionImport');
const QuestionImportRow = require('../models/QuestionImportRow');
const QuestionAttempt = require('../models/QuestionAttempt');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const registry = [
  ['courses', Course],
  ['subjects', Subject],
  ['teachers', User, { role: 'teacher' }],
  ['students', User, { role: 'student' }],
  ['slides', Content, { type: 'slide' }],
  ['achievements', Content, { type: 'achievement' }],
  ['exams', Exam],
  ['notifications', AcademyRecord, { module: 'notification' }],
  ['results', AcademyRecord, { module: 'result' }],
  ['reports', AcademyRecord, { module: 'report' }],
  ['payments', AcademyRecord, { module: 'payment' }]
];

const registryByResource = new Map(registry.map(([resource, Model, extraFilter = {}]) => [resource, { Model, extraFilter }]));

// A permanent subject delete must also remove every student-visible record
// linked to the subject. Otherwise an enrolled Android user can still load
// files/questions by the stale subject ID stored on a course.
const permanentlyDeleteSubjectAndContent = async (subjectId) => {
  const subject = await Subject.findOne({ _id: subjectId, isDeleted: true }).select('_id');
  if (!subject) return 0;

  const mockTests = await QuestionImport.find({ subject: subject._id }).select('_id');
  const mockTestIds = mockTests.map((item) => item._id);
  await Promise.all([
    Course.updateMany(
      { $or: [{ subjects: subject._id }, { 'subjectDetails.subject': subject._id }] },
      {
        $pull: {
          subjects: subject._id,
          subjectDetails: { subject: subject._id },
        },
      },
    ),
    SyllabusUnit.deleteMany({ subject: subject._id }),
    LearningFile.deleteMany({ subject: subject._id }),
    Content.deleteMany({ subject: subject._id }),
    Question.deleteMany({ subject: subject._id }),
    QuestionAttempt.deleteMany({ subject: subject._id }),
    AcademyRecord.deleteMany({ subject: subject._id }),
    mockTestIds.length ? QuestionImportRow.deleteMany({ importBatch: { $in: mockTestIds } }) : Promise.resolve(),
    QuestionImport.deleteMany({ subject: subject._id }),
  ]);
  await Subject.deleteOne({ _id: subject._id, isDeleted: true });
  return 1;
};

const listDeletedRecords = asyncHandler(async (req, res) => {
  const entries = await Promise.all(
    registry.map(async ([resource, Model, extraFilter = {}]) => {
      const records = await Model.find({ ...extraFilter, isDeleted: true })
        .select('name title email courseCode courseId subjectCode subjectId deletedAt deletedBy restoredAt restoredBy')
        .populate('deletedBy restoredBy', 'name email')
        .sort({ deletedAt: -1 })
        .limit(Number(req.query.limit || 25));
      return { resource, records };
    })
  );

  return apiResponse.success(res, { message: 'Deleted records fetched', data: entries });
});

const permanentlyDeleteRecords = asyncHandler(async (req, res) => {
  const records = Array.isArray(req.body.records) ? req.body.records : [];

  if (!records.length) {
    throw new AppError('Select at least one deleted item', STATUS_CODES.BAD_REQUEST);
  }

  const deletions = await Promise.all(
    records.map(async ({ resource, id }) => {
      const entry = registryByResource.get(resource);

      if (!entry || !id) {
        throw new AppError('Invalid deleted item selection', STATUS_CODES.BAD_REQUEST);
      }

      if (resource === 'subjects') return permanentlyDeleteSubjectAndContent(id);
      const result = await entry.Model.deleteOne({ _id: id, ...entry.extraFilter, isDeleted: true });
      return result.deletedCount;
    })
  );

  const deletedCount = deletions.reduce((total, count) => total + count, 0);

  return apiResponse.success(res, {
    message: `${deletedCount} deleted item(s) permanently removed`,
    data: { deletedCount },
  });
});

module.exports = { listDeletedRecords, permanentlyDeleteRecords };
