const ExcelJS = require('exceljs');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');
const SyllabusUnit = require('../models/SyllabusUnit');
const LearningFile = require('../models/LearningFile');
const Question = require('../models/Question');
const QuestionImport = require('../models/QuestionImport');
const QuestionAttempt = require('../models/QuestionAttempt');
const Enrollment = require('../models/Enrollment');
const AuditLog = require('../models/AuditLog');
const AcademyRecord = require('../models/AcademyRecord');
const Course = require('../models/Course');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

function signDownload(fileId, userId, role, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      fileId: String(fileId),
      userId: String(userId),
      role: String(role),
      expiresAt: now + 10 * 60 * 1000,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.jwt.accessSecret)
    .update(`learning:${payload}`)
    .digest('base64url');
  return `${payload}.${signature}`;
}
function verifyDownload(token, now = Date.now()) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac('sha256', env.jwt.accessSecret)
    .update(`learning:${payload}`)
    .digest('base64url');
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  )
    return null;
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return decoded.expiresAt >= now ? decoded : null;
}

const normalizeQuestion = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
async function assertSubjectAccess(req, subjectId) {
  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) return;
  if (
    req.user.role !== ROLES.TEACHER ||
    !(req.user.profile?.assignedSubjects || []).some((id) => String(id) === String(subjectId))
  )
    throw new AppError(
      'Teachers can manage content only for assigned subjects',
      STATUS_CODES.FORBIDDEN
    );
}
async function assertEnrollment(req, courseId) {
  if (req.user.role !== ROLES.STUDENT) return;
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: courseId,
    status: 'active',
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  });
  if (!enrollment)
    throw new AppError('An active course enrollment is required', STATUS_CODES.FORBIDDEN);
}
async function assertCourseSubject(courseId, subjectId) {
  if (!courseId || !subjectId) {
    throw new AppError('Course and subject are required', STATUS_CODES.BAD_REQUEST);
  }
  const assigned = await Course.exists({
    _id: courseId,
    subjects: subjectId,
    isDeleted: { $ne: true },
  });
  if (!assigned) {
    throw new AppError('The selected subject is not assigned to this course', STATUS_CODES.BAD_REQUEST);
  }
}

const listSyllabus = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.query.course);
  const filter = { isDeleted: { $ne: true } };
  if (req.query.course) filter.course = req.query.course;
  if (req.query.subject) filter.subject = req.query.subject;
  if (req.user.role === ROLES.STUDENT) filter.status = 'published';
  const items = await SyllabusUnit.find(filter)
    .populate('course subject')
    .sort({ displayOrder: 1, createdAt: 1 });
  return apiResponse.success(res, { message: 'Syllabus fetched', data: items });
});
const createSyllabus = asyncHandler(async (req, res) => {
  await assertSubjectAccess(req, req.body.subject);
  await assertCourseSubject(req.body.course, req.body.subject);
  const item = await SyllabusUnit.create({
    ...req.body,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'syllabus_created',
    module: 'syllabus',
    recordId: item._id,
    newValue: req.body,
    ipAddress: req.ip,
  });
  if (item.status === 'published') {
    await AcademyRecord.create({
      module: 'notification',
      title: 'New syllabus content',
      description: `${item.chapter}${item.topic ? ` · ${item.topic}` : ''}`,
      course: item.course,
      subject: item.subject,
      audience: 'students',
      status: 'active',
      payload: { type: 'syllabus_published', syllabusUnitId: item._id },
    });
  }
  return apiResponse.success(res, { statusCode: 201, message: 'Syllabus created', data: item });
});
const updateSyllabus = asyncHandler(async (req, res) => {
  const existing = await SyllabusUnit.findById(req.params.id);
  if (!existing) throw new AppError('Syllabus not found', 404);
  await assertSubjectAccess(req, existing.subject);
  const previousValue = existing.toObject();
  const allowed = ['chapter', 'topic', 'description', 'learningObjectives', 'displayOrder', 'status'];
  allowed.forEach((field) => {
    if (Object.hasOwn(req.body, field)) existing[field] = req.body[field];
  });
  existing.updatedBy = req.user._id;
  await existing.save();
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'syllabus_updated',
    module: 'syllabus',
    recordId: existing._id,
    previousValue,
    newValue: existing.toObject(),
    ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Syllabus updated', data: existing });
});
const removeSyllabus = asyncHandler(async (req, res) => {
  const item = await SyllabusUnit.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!item) throw new AppError('Syllabus not found', STATUS_CODES.NOT_FOUND);
  await assertSubjectAccess(req, item.subject);
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new AppError('A reason is required to remove syllabus content', STATUS_CODES.BAD_REQUEST);
  const previousValue = item.toObject();
  item.isDeleted = true;
  item.status = 'archived';
  item.deletedAt = new Date();
  item.deletedBy = req.user._id;
  item.updatedBy = req.user._id;
  await item.save();
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'syllabus_removed', module: 'syllabus',
    recordId: item._id, previousValue, newValue: { isDeleted: true, status: 'archived' },
    reason, ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Syllabus content archived' });
});

const listLearningFiles = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.query.course);
  const filter = { isDeleted: { $ne: true } };
  if (req.query.course) filter.course = req.query.course;
  if (req.query.subject) filter.subject = req.query.subject;
  if (['notes', 'question-paper', 'lecture', 'other'].includes(req.query.category)) {
    filter.category = req.query.category;
  }
  if (req.user.role === ROLES.STUDENT) filter.status = 'published';
  const items = await LearningFile.find(filter)
    .populate('course subject syllabusUnit')
    .sort({ createdAt: -1 });
  const data = items.map((item) => {
    const value = item.toObject();
    const token = signDownload(item._id, req.user._id, req.user.role);
    value.downloadUrl = `${req.baseUrl}/files/${item._id}/download?token=${encodeURIComponent(token)}`;
    delete value.fileUrl;
    delete value.storedFilename;
    return value;
  });
  return apiResponse.success(res, { message: 'Learning files fetched', data });
});
const downloadLearningFile = asyncHandler(async (req, res) => {
  let decoded;
  try {
    decoded = verifyDownload(req.query.token);
  } catch {
    decoded = null;
  }
  if (!decoded || String(decoded.fileId) !== String(req.params.id)) {
    throw new AppError('Download link is invalid', 403);
  }
  const item = await LearningFile.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
  });
  if (!item) throw new AppError('Learning file not found', 404);
  if (decoded.role === ROLES.STUDENT) {
    const enrollment = await Enrollment.exists({
      student: decoded.userId,
      course: item.course,
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });
    if (!enrollment) {
      throw new AppError('Course access has expired or been revoked', STATUS_CODES.FORBIDDEN);
    }
  } else if (![ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER].includes(decoded.role)) {
    throw new AppError('Download link is invalid', STATUS_CODES.FORBIDDEN);
  }
  const safeFilename = path.basename(item.storedFilename);
  return res.download(path.join(__dirname, '../uploads', safeFilename), item.originalFilename);
});
const createLearningFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('PDF, DOC, or DOCX file is required', 400);
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExtensions = new Map([
    ['application/pdf', '.pdf'],
    ['application/msword', '.doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ]);
  if (!allowed.includes(req.file.mimetype) || path.extname(req.file.originalname).toLowerCase() !== allowedExtensions.get(req.file.mimetype))
    throw new AppError('Only PDF, DOC, and DOCX learning files are allowed', 400);
  if (req.file.size > 25 * 1024 * 1024)
    throw new AppError('Learning file cannot exceed 25 MB', 400);
  await assertSubjectAccess(req, req.body.subject);
  await assertCourseSubject(req.body.course, req.body.subject);
  const item = await LearningFile.create({
    ...req.body,
    category: ['notes', 'question-paper', 'lecture', 'other'].includes(req.body.category)
      ? req.body.category
      : 'notes',
    originalFilename: req.file.originalname,
    storedFilename: req.file.filename,
    fileUrl: `/uploads/${req.file.filename}`,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'learning_file_uploaded',
    module: 'learning-files',
    recordId: item._id,
    newValue: { course: item.course, subject: item.subject, filename: item.originalFilename },
    ipAddress: req.ip,
  });
  if (item.status === 'published') {
    await AcademyRecord.create({
      module: 'notification',
      title: 'New learning file',
      description: item.title,
      course: item.course,
      subject: item.subject,
      audience: 'students',
      status: 'active',
      payload: { type: 'learning_file_published', learningFileId: item._id },
    });
  }
  return apiResponse.success(res, {
    statusCode: 201,
    message: 'Learning file uploaded',
    data: item,
  });
});
const updateLearningFile = asyncHandler(async (req, res) => {
  const item = await LearningFile.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!item) throw new AppError('Learning file not found', STATUS_CODES.NOT_FOUND);
  await assertSubjectAccess(req, item.subject);
  const previousValue = item.toObject();
  const allowed = ['title', 'description', 'category', 'status', 'syllabusUnit'];
  allowed.forEach((field) => {
    if (Object.hasOwn(req.body, field)) item[field] = req.body[field];
  });
  item.updatedBy = req.user._id;
  await item.save();
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'learning_file_updated',
    module: 'learning-files', recordId: item._id, previousValue,
    newValue: item.toObject(), ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Learning file updated', data: item });
});
const removeLearningFile = asyncHandler(async (req, res) => {
  const item = await LearningFile.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!item) throw new AppError('Learning file not found', STATUS_CODES.NOT_FOUND);
  await assertSubjectAccess(req, item.subject);
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new AppError('A reason is required to remove a learning file', STATUS_CODES.BAD_REQUEST);
  const previousValue = item.toObject();
  item.isDeleted = true;
  item.status = 'archived';
  item.deletedAt = new Date();
  item.deletedBy = req.user._id;
  item.updatedBy = req.user._id;
  await item.save();
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'learning_file_removed',
    module: 'learning-files', recordId: item._id, previousValue,
    newValue: { isDeleted: true, status: 'archived' }, reason, ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Learning file archived' });
});

const questionTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');
  sheet.addRow([
    'Question',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Option',
    'Explanation',
    'Marks',
    'Negative Marks',
    'Difficulty',
    'Chapter',
    'Topic',
  ]);
  sheet.addRow([
    'Example question?',
    'First answer',
    'Second answer',
    '',
    '',
    'A',
    'Optional explanation',
    1,
    0,
    'medium',
    'Unit 1',
    'Topic 1',
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="question-template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});
const previewQuestions = asyncHandler(async (req, res) => {
  if (
    !req.file ||
    req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    path.extname(req.file.originalname).toLowerCase() !== '.xlsx'
  )
    throw new AppError('A valid XLSX file is required', 400);
  await assertSubjectAccess(req, req.body.subject);
  await assertCourseSubject(req.body.course, req.body.subject);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(req.file.path);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError('The workbook is empty', 400);
  if (sheet.rowCount - 1 > 500)
    throw new AppError('A maximum of 500 question rows is allowed', 400);
  const headers = {};
  sheet.getRow(1).eachCell((cell, col) => {
    headers[String(cell.text).trim().toLowerCase()] = col;
  });
  const get = (row, name) => row.getCell(headers[name] || 0).text.trim();
  const rows = [];
  const seen = new Set();
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const data = {
      questionText: get(row, 'question'),
      optionA: get(row, 'option a'),
      optionB: get(row, 'option b'),
      optionC: get(row, 'option c'),
      optionD: get(row, 'option d'),
      correctOption: get(row, 'correct option').toUpperCase(),
      explanation: get(row, 'explanation'),
      marks: Number(get(row, 'marks') || 1),
      negativeMarks: Number(get(row, 'negative marks') || 0),
      difficulty: (get(row, 'difficulty') || 'medium').toLowerCase(),
      chapter: get(row, 'chapter'),
      topic: get(row, 'topic'),
    };
    if (!data.questionText && !data.optionA && !data.optionB) continue;
    const errors = [];
    const normalized = normalizeQuestion(data.questionText);
    if (!data.questionText) errors.push('Question is required');
    if (!data.optionA || !data.optionB) errors.push('Option A and Option B are required');
    if (!['A', 'B', 'C', 'D'].includes(data.correctOption) || !data[`option${data.correctOption}`])
      errors.push('Correct Option must match an available option');
    if (!Number.isFinite(data.marks) || data.marks < 0) errors.push('Marks must be non-negative');
    if (!Number.isFinite(data.negativeMarks) || data.negativeMarks < 0)
      errors.push('Negative Marks must be non-negative');
    if (seen.has(normalized)) errors.push('Duplicate question in this upload');
    seen.add(normalized);
    rows.push({
      rowNumber: number,
      data: { ...data, normalizedText: normalized },
      valid: !errors.length,
      validationErrors: errors,
    });
  }
  const existing = new Set(
    (
      await Question.find({
        course: req.body.course,
        subject: req.body.subject,
        normalizedText: { $in: rows.map((row) => row.data.normalizedText) },
      }).select('normalizedText')
    ).map((item) => item.normalizedText)
  );
  rows.forEach((row) => {
    if (existing.has(row.data.normalizedText)) {
      row.valid = false;
      row.validationErrors.push('Question already exists for this subject');
    }
  });
  const item = await QuestionImport.create({
    course: req.body.course,
    subject: req.body.subject,
    originalFilename: req.file.originalname,
    storedFilename: req.file.filename,
    fileUrl: `/uploads/${req.file.filename}`,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.valid).length,
    invalidRows: rows.filter((row) => !row.valid).length,
    rows,
    createdBy: req.user._id,
  });
  return apiResponse.success(res, { message: 'Question file previewed', data: item });
});
const confirmQuestions = asyncHandler(async (req, res) => {
  const batch = await QuestionImport.findById(req.params.id);
  if (!batch) throw new AppError('Question import not found', 404);
  await assertSubjectAccess(req, batch.subject);
  if (batch.status !== 'previewed') throw new AppError('Question import is already processed', 409);
  const validRows = batch.rows.filter((row) => row.valid);
  if (!validRows.length) throw new AppError('There are no valid rows to import', 400);
  const questions = validRows.map((row) => {
    const d = row.data;
    return {
      course: batch.course,
      subject: batch.subject,
      questionText: d.questionText,
      normalizedText: d.normalizedText,
      options: [
        ['A', d.optionA],
        ['B', d.optionB],
        ['C', d.optionC],
        ['D', d.optionD],
      ]
        .filter(([, text]) => text)
        .map(([key, text]) => ({ key, text })),
      correctOption: d.correctOption,
      explanation: d.explanation,
      marks: d.marks,
      negativeMarks: d.negativeMarks,
      difficulty: ['easy', 'medium', 'hard'].includes(d.difficulty) ? d.difficulty : 'medium',
      chapter: d.chapter,
      topic: d.topic,
      importBatch: batch._id,
      createdBy: req.user._id,
    };
  });
  await Question.insertMany(questions, { ordered: true });
  batch.status = 'imported';
  batch.importedAt = new Date();
  batch.updatedBy = req.user._id;
  await batch.save();
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'questions_imported',
    module: 'questions',
    recordId: batch._id,
    newValue: { count: questions.length },
    ipAddress: req.ip,
  });
  await AcademyRecord.create({
    module: 'notification',
    title: 'New question bank available',
    description: `${questions.length} questions are ready to attempt.`,
    course: batch.course,
    subject: batch.subject,
    audience: 'students',
    status: 'active',
    payload: {
      type: 'question_bank_published',
      importBatchId: batch._id,
      questionCount: questions.length,
    },
  });
  return apiResponse.success(res, {
    message: `${questions.length} questions imported`,
    data: { imported: questions.length, rejected: batch.invalidRows },
  });
});
const listQuestions = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.query.course);
  const filter = {
    course: req.query.course,
    subject: req.query.subject,
    status: 'published',
    isDeleted: { $ne: true },
  };
  const items = await Question.find(filter)
    .select('-normalizedText')
    .sort({ chapter: 1, createdAt: 1 })
    .limit(500);
  return apiResponse.success(res, { message: 'Questions fetched', data: items });
});
const submitAnswers = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.body.course);
  const submittedAnswers = req.body.answers || [];
  if (!submittedAnswers.length) throw new AppError('At least one answer is required', 400);
  const ids = submittedAnswers.map((answer) => String(answer.question));
  if (new Set(ids).size !== ids.length)
    throw new AppError('Each question can be answered only once', 400);
  const questions = await Question.find({
    course: req.body.course,
    subject: req.body.subject,
    status: 'published',
    isDeleted: { $ne: true },
  }).select('+correctOption +explanation');
  if (
    questions.length !== submittedAnswers.length ||
    questions.some((question) => !ids.includes(String(question._id)))
  ) {
    throw new AppError('Submit exactly one answer for every published question', 400);
  }
  const byId = new Map(questions.map((question) => [String(question._id), question]));
  let score = 0;
  let maximumScore = 0;
  const answers = submittedAnswers.map((answer) => {
    const question = byId.get(String(answer.question));
    if (!question) throw new AppError('Invalid question in submission', 400);
    if (!(question.options || []).some((option) => option.key === answer.selectedOption)) {
      throw new AppError('Selected option is not available for this question', 400);
    }
    maximumScore += question.marks;
    const correct = answer.selectedOption === question.correctOption;
    const marksAwarded = correct ? question.marks : -question.negativeMarks;
    score += marksAwarded;
    return {
      question: question._id,
      selectedOption: answer.selectedOption,
      correct,
      marksAwarded,
      correctOption: question.correctOption,
      explanation: question.explanation,
    };
  });
  const attempt = await QuestionAttempt.create({
    student: req.user._id,
    course: req.body.course,
    subject: req.body.subject,
    answers,
    score,
    maximumScore,
  });
  await AcademyRecord.create({
    module: 'result',
    title: 'Question bank attempt',
    description: `Score ${score} out of ${maximumScore}`,
    student: req.user._id,
    course: req.body.course,
    subject: req.body.subject,
    score,
    maximumScore,
    status: maximumScore > 0 && score / maximumScore >= 0.4 ? 'passed' : 'failed',
    audience: 'students',
    payload: { questionAttemptId: attempt._id, submittedAt: attempt.submittedAt },
  });
  return apiResponse.success(res, {
    message: 'Answers submitted',
    data: { attemptId: attempt._id, score, maximumScore, answers },
  });
});
module.exports = {
  listSyllabus,
  createSyllabus,
  updateSyllabus,
  removeSyllabus,
  listLearningFiles,
  downloadLearningFile,
  createLearningFile,
  updateLearningFile,
  removeLearningFile,
  questionTemplate,
  previewQuestions,
  confirmQuestions,
  listQuestions,
  submitAnswers,
  _internals: { signDownload, verifyDownload, assertSubjectAccess, assertCourseSubject },
};
