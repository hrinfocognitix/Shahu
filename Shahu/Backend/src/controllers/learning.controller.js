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
const QuestionImportRow = require('../models/QuestionImportRow');
const QuestionAttempt = require('../models/QuestionAttempt');
const Enrollment = require('../models/Enrollment');
const AuditLog = require('../models/AuditLog');
const AcademyRecord = require('../models/AcademyRecord');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const { execFile: executeFile } = require('child_process');
const { promisify } = require('util');
const env = require('../config/env');
const logger = require('../config/logger');
const { uploadBuffer, destroyAsset } = require('../services/cloudinary.service');

const execFile = promisify(executeFile);
const OFFICE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_QUESTION_IMPORT_ROWS = Math.max(
  1,
  Number.parseInt(process.env.MAX_QUESTION_IMPORT_ROWS || '100000', 10) || 100000,
);
const IMPORT_ROW_BATCH_SIZE = 1000;
const PREVIEW_ROW_SAMPLE_SIZE = 100;

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
const normalizedOptionSignature = (options) =>
  ['A', 'B', 'C', 'D']
    .map((key) => normalizeQuestion(options?.[key]))
    .join('\u001f');
// Old uploads from browsers that sent UTF-8 filenames as Latin-1 can appear
// as "à¤—...". Repair only that recognizable mojibake pattern for display.
const readableFilename = (value) => {
  const filename = String(value || '');
  if (!/[àÃâ]/.test(filename)) return filename;
  try {
    const repaired = Buffer.from(filename, 'latin1').toString('utf8');
    return repaired.includes('�') ? filename : repaired;
  } catch {
    return filename;
  }
};
const wordCount = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};
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
async function assertStudentLearningFileAccess(userId, item) {
  const accessWindow = {
    student: userId,
    status: 'active',
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  };
  if (item.course) {
    accessWindow.course = item.course;
  } else {
    // Subject-level material is visible only through a course that contains
    // the subject and to which the student is currently enrolled.
    const courseIds = await Course.find({ subjects: item.subject, isDeleted: { $ne: true } }).distinct('_id');
    accessWindow.course = { $in: courseIds };
  }
  const enrollment = await Enrollment.exists(accessWindow);
  if (!enrollment) throw new AppError('Course access has expired or been revoked', STATUS_CODES.FORBIDDEN);
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

async function assertSubjectExists(subjectId) {
  if (!subjectId) throw new AppError('A subject is required', STATUS_CODES.BAD_REQUEST);
  const subject = await Subject.exists({ _id: subjectId, isDeleted: { $ne: true } });
  if (!subject) throw new AppError('The selected subject was not found', STATUS_CODES.NOT_FOUND);
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
  if (req.query.unassigned === 'true') {
    filter.course = { $exists: false };
  } else if (req.query.course) {
    // Subject-level material becomes available as soon as its subject is
    // attached to this course, without a second upload. Limit the fallback
    // to that course's subjects so a student does not receive unrelated
    // material.
    const course = await Course.findById(req.query.course).select('subjects');
    const subjectIds = course?.subjects || [];
    filter.$or = [
      { course: req.query.course },
      {
        course: { $exists: false },
        subject: { $in: subjectIds },
      },
    ];
  }
  if (req.query.subject) filter.subject = req.query.subject;
  if (['syllabus-copy', 'notes', 'generated-questions', 'question-paper', 'mock-test', 'other'].includes(req.query.category)) {
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
    value.previewUrl = `${req.baseUrl}/files/${item._id}/preview?token=${encodeURIComponent(token)}`;
    value.previewMimeType = OFFICE_MIME_TYPES.has(item.mimeType) ? 'application/pdf' : item.mimeType;
    // Mobile opens Cloudinary-hosted images/PDFs directly in its native
    // viewer. The signed URLs remain available for legacy and download flows.
    value.cloudinaryUrl = value.fileUrl?.startsWith('https://') ? value.fileUrl : undefined;
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
    await assertStudentLearningFileAccess(decoded.userId, item);
  } else if (![ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER].includes(decoded.role)) {
    throw new AppError('Download link is invalid', STATUS_CODES.FORBIDDEN);
  }
  if (!item.fileUrl?.startsWith('https://')) throw new AppError('This uploaded file is no longer available. Please ask an administrator to upload it again.', STATUS_CODES.NOT_FOUND);
  return res.redirect(302, item.fileUrl);
});

const previewLearningFile = asyncHandler(async (req, res) => {
  let decoded;
  try { decoded = verifyDownload(req.query.token); } catch { decoded = null; }
  if (!decoded || String(decoded.fileId) !== String(req.params.id)) {
    throw new AppError('Preview link is invalid', STATUS_CODES.FORBIDDEN);
  }
  const item = await LearningFile.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!item) throw new AppError('Learning file not found', STATUS_CODES.NOT_FOUND);
  logger.info('Learning file preview requested', {
    requestId: req.requestId,
    learningFileId: String(item._id),
    fileName: item.originalFilename,
    mimeType: item.mimeType,
    requesterRole: decoded.role,
  });
  if (decoded.role === ROLES.STUDENT) {
    await assertStudentLearningFileAccess(decoded.userId, item);
  } else if (![ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER].includes(decoded.role)) {
    throw new AppError('Preview link is invalid', STATUS_CODES.FORBIDDEN);
  }

  // Helmet correctly blocks arbitrary pages from framing API responses. This
  // one signed, time-limited endpoint is intentionally shown inside the
  // academy portal preview modal, so allow only the configured portal origin.
  res.removeHeader('X-Frame-Options');
  // The URL contains a short-lived, signed token and is accessible only after
  // enrollment verification.  It must be frameable by the academy web portal,
  // including LAN/dev deployments whose browser origin differs from the API.
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!OFFICE_MIME_TYPES.has(item.mimeType)) {
    if (!(item.mimeType === 'application/pdf' || item.mimeType.startsWith('image/') || item.mimeType.startsWith('text/'))) {
      throw new AppError('This file type cannot be previewed in the app', 415);
    }
    if (!item.fileUrl?.startsWith('https://')) throw new AppError('This uploaded file is no longer available. Please ask an administrator to upload it again.', STATUS_CODES.NOT_FOUND);
    logger.info('Learning file preview redirecting to Cloudinary', { requestId: req.requestId, learningFileId: String(item._id), previewMimeType: item.mimeType });
    return res.redirect(302, item.fileUrl);
  }

  // LibreOffice renders Office documents to a short-lived server-private PDF.
  // Set LIBREOFFICE_BIN when the command is not named "soffice" on the server.
  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shahu-preview-'));
  const cleanup = () => fs.rm(temporaryDir, { recursive: true, force: true }).catch(() => undefined);
  try {
    if (!item.fileUrl?.startsWith('https://')) throw new AppError('This uploaded file is no longer available. Please ask an administrator to upload it again.', STATUS_CODES.NOT_FOUND);
    const response = await fetch(item.fileUrl);
    if (!response.ok) throw new Error(`Cloudinary download failed (${response.status})`);
    const sourcePath = path.join(temporaryDir, path.basename(item.originalFilename));
    await fs.writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
    await execFile(process.env.LIBREOFFICE_BIN || 'soffice', ['--headless', '--convert-to', 'pdf', '--outdir', temporaryDir, sourcePath], { timeout: 90000 });
    const generated = (await fs.readdir(temporaryDir)).find(file => file.toLowerCase().endsWith('.pdf'));
    if (!generated) throw new Error('LibreOffice did not produce a PDF.');
    res.type('application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(item.originalFilename, path.extname(item.originalFilename)))}.pdf"`);
    res.once('finish', cleanup);
    res.once('close', cleanup);
    logger.info('Learning document preview converted', { requestId: req.requestId, learningFileId: String(item._id), previewMimeType: 'application/pdf' });
    return res.sendFile(path.join(temporaryDir, generated));
  } catch (error) {
    await cleanup();
    logger.warn('Learning document preview conversion failed', { requestId: req.requestId, learningFileId: String(item._id), error: error.message, errorCode: error.code });
    if (error && error.code === 'ENOENT') {
      throw new AppError('Document preview conversion is not configured. Install LibreOffice on the server.', STATUS_CODES.SERVICE_UNAVAILABLE);
    }
    throw new AppError('This document could not be converted for preview.', STATUS_CODES.UNPROCESSABLE_ENTITY);
  }
});
const createLearningFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('A PDF, DOC, DOCX, or image file is required', 400);
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  const allowedExtensions = new Map([
    ['application/pdf', '.pdf'],
    ['application/msword', '.doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
  ]);
  const extension = path.extname(req.file.originalname).toLowerCase();
  const permittedExtensions = req.file.mimetype === 'image/jpeg' ? ['.jpg', '.jpeg'] : [allowedExtensions.get(req.file.mimetype)];
  if (!allowed.includes(req.file.mimetype) || !permittedExtensions.includes(extension))
    throw new AppError('Only PDF, DOC, DOCX, JPG, PNG, and WEBP learning files are allowed', 400);
  if (req.file.size > 25 * 1024 * 1024)
    throw new AppError('Learning file cannot exceed 25 MB', 400);
  await assertSubjectAccess(req, req.body.subject);
  await assertSubjectExists(req.body.subject);
  const category = ['syllabus-copy', 'notes', 'generated-questions', 'question-paper', 'mock-test', 'other'].includes(req.body.category)
    ? req.body.category
    : 'notes';
  const courseId = String(req.body.course || '').trim();
  if (courseId) {
    await assertCourseSubject(courseId, req.body.subject);
  }
  const learningPayload = { ...req.body };
  delete learningPayload.course;
  const upload = await uploadBuffer(req.file, { folder: 'shahu-academy/learning-files' });
  let item;
  try { item = await LearningFile.create({
    ...learningPayload,
    ...(courseId ? { course: courseId } : {}),
    category,
    originalFilename: readableFilename(req.file.originalname),
    storedFilename: upload.public_id,
    fileUrl: upload.secure_url,
    publicId: upload.public_id,
    cloudinaryResourceType: upload.resource_type,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  }); } catch (error) {
    await destroyAsset(upload.public_id, upload.resource_type).catch(() => undefined);
    throw error;
  }
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
const importLearningFiles = asyncHandler(async (req, res) => {
  const { course, subject, sourceCourse, sourceSubject } = req.body;
  const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
  const allowedCategories = ['syllabus-copy', 'notes', 'generated-questions', 'question-paper', 'mock-test', 'other'];
  const selectedCategories = [...new Set(categories.filter((category) => allowedCategories.includes(category)))];

  if (!sourceCourse || !sourceSubject || !selectedCategories.length) {
    throw new AppError('Source course, source subject, and at least one material type are required', 400);
  }
  if (String(course) === String(sourceCourse) && String(subject) === String(sourceSubject)) {
    throw new AppError('Choose a different source course or subject to import material', 400);
  }

  await assertSubjectAccess(req, subject);
  await assertSubjectAccess(req, sourceSubject);
  await assertCourseSubject(course, subject);
  await assertCourseSubject(sourceCourse, sourceSubject);

  const sourceFiles = await LearningFile.find({
    course: sourceCourse,
    subject: sourceSubject,
    category: { $in: selectedCategories },
    status: 'published',
    isDeleted: { $ne: true },
  });
  if (!sourceFiles.length) {
    throw new AppError('No published material was found for the selected source', STATUS_CODES.NOT_FOUND);
  }

  const copiedSourceIds = await LearningFile.find({
    course,
    subject,
    copiedFrom: { $in: sourceFiles.map((file) => file._id) },
    isDeleted: { $ne: true },
  }).distinct('copiedFrom');
  const alreadyCopied = new Set(copiedSourceIds.map(String));
  const filesToCopy = sourceFiles.filter((file) => !alreadyCopied.has(String(file._id)));
  if (!filesToCopy.length) {
    throw new AppError('The selected material has already been imported for this course and subject', 400);
  }

  const copiedFiles = await LearningFile.insertMany(
    filesToCopy.map((file) => ({
      course,
      subject,
      title: file.title,
      description: file.description,
      category: file.category,
      unitTitle: file.unitTitle,
      customType: file.customType,
      originalFilename: file.originalFilename,
      storedFilename: file.storedFilename,
      fileUrl: file.fileUrl,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      status: 'published',
      copiedFrom: file._id,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })),
  );
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'learning_files_imported',
    module: 'learning-files',
    recordId: copiedFiles[0]._id,
    newValue: { course, subject, sourceCourse, sourceSubject, categories: selectedCategories, count: copiedFiles.length },
    ipAddress: req.ip,
  });
  return apiResponse.success(res, {
    statusCode: 201,
    message: `${copiedFiles.length} material file(s) imported`,
    data: copiedFiles,
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
  // Imported copies share one Cloudinary object. Do not remove it while an
  // active copy is still available in another course/subject.
  const remaining = item.publicId ? await LearningFile.exists({ _id: { $ne: item._id }, publicId: item.publicId, isDeleted: { $ne: true } }) : null;
  if (item.publicId && !remaining) await destroyAsset(item.publicId, item.cloudinaryResourceType).catch(() => undefined);
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'learning_file_removed',
    module: 'learning-files', recordId: item._id, previousValue,
    newValue: { isDeleted: true, status: 'archived' }, reason, ipAddress: req.ip,
  });
  return apiResponse.success(res, { message: 'Learning file archived' });
});

const questionTemplate = asyncHandler(async (req, res) => {
  let workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');
  sheet.addRow([
    'क्रमांक',
    'प्रकरण',
    'प्रश्न',
    'पर्याय अ',
    'पर्याय ब',
    'पर्याय क',
    'पर्याय ड',
    'योग्य उत्तर',
    'स्पष्टीकरण',
  ]);
  sheet.addRow([
    1,
    'सामान्य ज्ञान',
    'महाराष्ट्राची राजधानी कोणती आहे?',
    'मुंबई',
    'पुणे',
    'नाशिक',
    'नागपूर',
    'अ',
    'मुंबई ही महाराष्ट्राची राजधानी आहे.',
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
  const extension = path.extname(req.file?.originalname || '').toLowerCase();
  const uploadMeta = {
    requestId: req.requestId,
    fileName: req.file?.originalname,
    extension,
    fileSize: req.file?.size,
    mimeType: req.file?.mimetype,
    courseId: req.body.course,
    subjectId: req.body.subject,
    userId: req.user?._id?.toString(),
  };
  console.log('[MockTest] spreadsheet validation received', uploadMeta);
  logger.info('Mock-test spreadsheet validation started', uploadMeta);
  if (!req.file || !['.xlsx', '.csv'].includes(extension)) {
    logger.warn('Mock-test spreadsheet validation rejected', { ...uploadMeta, reason: 'unsupported_extension' });
    throw new AppError('Upload an .xlsx or .csv file. For a Mac Numbers file, use File → Export To → Excel or CSV first.', 400);
  }
  await assertSubjectAccess(req, req.body.subject);
  await assertCourseSubject(req.body.course, req.body.subject);
  const selectedCourse = await Course.findById(req.body.course).select('subjects').lean();
  const courseSubjects = await Subject.find({
    // Admin workbook imports can include several existing academy subjects.
    // Teachers remain restricted to subjects already attached to the course.
    ...([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)
      ? {}
      : { _id: { $in: selectedCourse?.subjects || [] } }),
    isDeleted: { $ne: true },
  }).select('name');
  const subjectIdsByName = new Map(
    courseSubjects.map((subject) => [normalizeQuestion(subject.name), String(subject._id)])
  );
  const headers = {};
  const rows = [];
  const seen = new Set();
  let worksheetName;
  let sourceRows = 0;
  const consumeRow = (row, number) => {
    const get = (...names) => {
      const column = names.map((name) => headers[name.toLowerCase()]).find(Boolean);
      return column ? row.getCell(column).text.trim() : '';
    };
    const data = {
      sheetSubject: get('subject'), questionText: get('question', 'प्रश्न'),
      optionA: get('option1', 'option a', 'पर्याय अ'), optionB: get('option2', 'option b', 'पर्याय ब'),
      optionC: get('option3', 'option c', 'पर्याय क'), optionD: get('option4', 'option d', 'पर्याय ड'),
      correctAnswer: get('correctanswer', 'correct option', 'योग्य उत्तर'), explanation: get('justification', 'explanation', 'स्पष्टीकरण'),
      marks: Number(get('marks') || 1), negativeMarks: Number(get('negativemarks', 'negative marks') || 0),
      difficulty: (get('difficulty') || 'medium').toLowerCase(), chapter: get('chapter', 'प्रकरण'), topic: get('topic', 'प्रकरण'),
      questionType: get('questiontype') || 'MCQ', questionImage: get('questionimage'), option1Image: get('option1image'),
      option2Image: get('option2image'), option3Image: get('option3image'), option4Image: get('option4image'),
      explanationImage: get('explanationimage'), status: (get('status') || 'published').toLowerCase(),
    };
    const answer = data.correctAnswer.trim();
    const marathiOptionKeys = { 'अ': 'A', 'ब': 'B', 'क': 'C', 'ड': 'D' };
    if (marathiOptionKeys[answer]) data.correctOption = marathiOptionKeys[answer];
    else if (/^[a-d]$/i.test(answer)) data.correctOption = answer.toUpperCase();
    else if (/^option\s*[1-4]$/i.test(answer)) data.correctOption = String.fromCharCode(64 + Number(answer.match(/[1-4]/)[0]));
    else data.correctOption = ['A', 'B', 'C', 'D'].find((key) => data[`option${key}`] === answer) || ({ 'पर्याय अ': 'A', 'पर्याय ब': 'B', 'पर्याय क': 'C', 'पर्याय ड': 'D' }[answer]) || '';
    data.subject = data.sheetSubject ? subjectIdsByName.get(normalizeQuestion(data.sheetSubject)) : String(req.body.subject);
    if (!data.questionText && !data.optionA && !data.optionB) return;
    const errors = [];
    const normalized = normalizeQuestion(data.questionText);
    if (!data.questionText) errors.push('Question is required');
    if (!data.subject) errors.push(`Subject "${data.sheetSubject}" is not assigned to the selected course`);
    if (!data.optionA || !data.optionB) errors.push('Option A and Option B are required');
    if (!['A', 'B', 'C', 'D'].includes(data.correctOption) || !data[`option${data.correctOption}`]) errors.push('Correct Option must match an available option');
    if (!Number.isFinite(data.marks) || data.marks < 0) errors.push('Marks must be non-negative');
    if (!Number.isFinite(data.negativeMarks) || data.negativeMarks < 0) errors.push('Negative Marks must be non-negative');
    if (wordCount(data.explanation) > 50) errors.push('Justification must be 50 words or fewer');
    if (!['easy', 'medium', 'hard'].includes(data.difficulty)) errors.push('Difficulty must be easy, medium, or hard');
    if (!['published', 'draft', 'archived'].includes(data.status)) errors.push('Status must be published, draft, or archived');
    const normalizedOptions = normalizedOptionSignature({
      A: data.optionA, B: data.optionB, C: data.optionC, D: data.optionD,
    });
    const duplicateKey = `${String(data.subject)}:${normalized}:${normalizedOptions}`;
    const duplicateInUpload = seen.has(duplicateKey);
    seen.add(duplicateKey);
    rows.push({ rowNumber: number, data: { ...data, normalizedText: normalized, normalizedOptions }, valid: !errors.length && !duplicateInUpload, skipped: duplicateInUpload, validationErrors: errors });
  };
  logger.info('Mock-test spreadsheet source-file reading started', uploadMeta);
  try {
    if (extension === '.csv') {
      const workbook = new ExcelJS.Workbook();
      await workbook.csv.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      worksheetName = sheet?.name;
      if (sheet) {
        sheet.getRow(1).eachCell((cell, col) => { headers[String(cell.text).trim().toLowerCase()] = col; });
        for (let number = 2; number <= sheet.rowCount; number += 1) { sourceRows += 1; if (sourceRows > MAX_QUESTION_IMPORT_ROWS) break; consumeRow(sheet.getRow(number), number); }
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      worksheetName = sheet?.name;
      if (sheet) {
        sheet.getRow(1).eachCell((cell, col) => { headers[String(cell.text).trim().toLowerCase()] = col; });
        for (let number = 2; number <= sheet.rowCount; number += 1) { sourceRows += 1; if (sourceRows > MAX_QUESTION_IMPORT_ROWS) break; consumeRow(sheet.getRow(number), number); }
      }
    }
  } catch (error) {
    logger.warn('Mock-test spreadsheet could not be read', { ...uploadMeta, parseError: error.message });
    throw new AppError('This file is not a readable .xlsx or .csv file. Download the template, or export your Numbers sheet to Excel/CSV, and try again.', 400);
  }
  if (!worksheetName) {
    logger.warn('Mock-test spreadsheet validation rejected', { ...uploadMeta, reason: 'empty_workbook' });
    throw new AppError('The workbook is empty', 400);
  }
  if (sourceRows > MAX_QUESTION_IMPORT_ROWS) {
    logger.warn('Mock-test spreadsheet validation rejected', { ...uploadMeta, reason: 'row_limit_exceeded', rowCount: sourceRows, maximumRows: MAX_QUESTION_IMPORT_ROWS });
    throw new AppError(`A maximum of ${MAX_QUESTION_IMPORT_ROWS.toLocaleString()} question rows is allowed per upload`, 400);
  }
  logger.info('Mock-test spreadsheet parsed', { ...uploadMeta, worksheetName, sourceRows });
  /* for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const data = {
      sheetSubject: get(row, 'subject'),
      questionText: get(row, 'question', 'प्रश्न'),
      optionA: get(row, 'option1', 'option a', 'पर्याय अ'),
      optionB: get(row, 'option2', 'option b', 'पर्याय ब'),
      optionC: get(row, 'option3', 'option c', 'पर्याय क'),
      optionD: get(row, 'option4', 'option d', 'पर्याय ड'),
      correctAnswer: get(row, 'correctanswer', 'correct option', 'योग्य उत्तर'),
      explanation: get(row, 'justification', 'explanation', 'स्पष्टीकरण'),
      marks: Number(get(row, 'marks') || 1),
      negativeMarks: Number(get(row, 'negativemarks', 'negative marks') || 0),
      difficulty: (get(row, 'difficulty') || 'medium').toLowerCase(),
      chapter: get(row, 'chapter', 'प्रकरण'),
      topic: get(row, 'topic', 'प्रकरण'),
      questionType: get(row, 'questiontype') || 'MCQ',
      questionImage: get(row, 'questionimage'),
      option1Image: get(row, 'option1image'),
      option2Image: get(row, 'option2image'),
      option3Image: get(row, 'option3image'),
      option4Image: get(row, 'option4image'),
      explanationImage: get(row, 'explanationimage'),
      status: (get(row, 'status') || 'published').toLowerCase(),
    };
    const answer = data.correctAnswer.trim();
    const marathiOptionKeys = { 'अ': 'A', 'ब': 'B', 'क': 'C', 'ड': 'D' };
    if (marathiOptionKeys[answer]) data.correctOption = marathiOptionKeys[answer];
    else if (/^[a-d]$/i.test(answer)) data.correctOption = answer.toUpperCase();
    else if (/^option\s*[1-4]$/i.test(answer)) {
      data.correctOption = String.fromCharCode(64 + Number(answer.match(/[1-4]/)[0]));
    } else {
      data.correctOption = ['A', 'B', 'C', 'D'].find((key) => data[`option${key}`] === answer)
        || ({ 'पर्याय अ': 'A', 'पर्याय ब': 'B', 'पर्याय क': 'C', 'पर्याय ड': 'D' }[answer])
        || '';
    }
    // A workbook may contain several subjects. If a Subject column is present,
    // resolve it only within the course selected by the admin. Blank values keep
    // the subject selected from the card that opened this upload dialog.
    data.subject = data.sheetSubject
      ? subjectIdsByName.get(normalizeQuestion(data.sheetSubject))
      : String(req.body.subject);
    if (!data.questionText && !data.optionA && !data.optionB) continue;
    const errors = [];
    const normalized = normalizeQuestion(data.questionText);
    if (!data.questionText) errors.push('Question is required');
    if (!data.subject) errors.push(`Subject "${data.sheetSubject}" is not assigned to the selected course`);
    if (!data.optionA || !data.optionB) errors.push('Option A and Option B are required');
    if (!['A', 'B', 'C', 'D'].includes(data.correctOption) || !data[`option${data.correctOption}`])
      errors.push('Correct Option must match an available option');
    if (!Number.isFinite(data.marks) || data.marks < 0) errors.push('Marks must be non-negative');
    if (!Number.isFinite(data.negativeMarks) || data.negativeMarks < 0)
      errors.push('Negative Marks must be non-negative');
    if (wordCount(data.explanation) > 50) errors.push('Justification must be 50 words or fewer');
    if (!['easy', 'medium', 'hard'].includes(data.difficulty)) errors.push('Difficulty must be easy, medium, or hard');
    if (!['published', 'draft', 'archived'].includes(data.status)) errors.push('Status must be published, draft, or archived');
    const duplicateKey = `${String(data.subject)}:${normalized}`;
    const duplicateInUpload = seen.has(duplicateKey);
    seen.add(duplicateKey);
    rows.push({
      rowNumber: number,
      data: { ...data, normalizedText: normalized },
      // Keep the first occurrence and silently skip subsequent repeated rows.
      // This lets a large source sheet import cleanly without presenting the
      // same duplicate warning for every repeated question.
      valid: !errors.length && !duplicateInUpload,
      skipped: duplicateInUpload,
      validationErrors: errors,
    });
  } */
  const existing = new Set();
  const candidates = rows.filter((row) => row.data.subject);
  // Keep the duplicate lookup under MongoDB's query-size limit for very large
  // workbooks. Each batch is deliberately small enough for long questions too.
  for (let index = 0; index < candidates.length; index += IMPORT_ROW_BATCH_SIZE) {
    const matches = await Question.find({
      course: req.body.course,
      $or: candidates.slice(index, index + IMPORT_ROW_BATCH_SIZE).map((row) => ({
        subject: row.data.subject,
        normalizedText: row.data.normalizedText,
      })),
    }).select('subject normalizedText normalizedOptions options');
    matches.forEach((item) => {
      const options = Object.fromEntries((item.options || []).map((option) => [option.key, option.text]));
      const signature = item.normalizedOptions || normalizedOptionSignature(options);
      existing.add(`${String(item.subject)}:${item.normalizedText}:${signature}`);
    });
  }
  rows.forEach((row) => {
    if (existing.has(`${String(row.data.subject)}:${row.data.normalizedText}:${row.data.normalizedOptions}`)) {
      row.valid = false;
      row.skipped = true;
      row.validationErrors.push('Question already exists for this subject');
    }
  });
  const validRows = rows.filter((row) => row.valid).length;
  const duplicateRows = rows.filter((row) => row.skipped).length;
  const item = await QuestionImport.create({
    course: req.body.course,
    subject: req.body.subject,
    originalFilename: readableFilename(req.file.originalname),
    // Spreadsheet data is parsed immediately and stored as question rows.
    // The original is deliberately not written to Render's filesystem.
    storedFilename: `${Date.now()}-${readableFilename(req.file.originalname)}`,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows - duplicateRows,
    duplicateRows,
    hasExternalRows: true,
    // The response keeps a compact preview for the portal; all import rows are
    // stored separately so a 100,000-question paper remains valid in MongoDB.
    rows: rows.slice(0, PREVIEW_ROW_SAMPLE_SIZE),
    createdBy: req.user._id,
  });
  try {
    for (let index = 0; index < rows.length; index += IMPORT_ROW_BATCH_SIZE) {
      await QuestionImportRow.insertMany(
        rows.slice(index, index + IMPORT_ROW_BATCH_SIZE).map((row) => ({
          importBatch: item._id,
          rowNumber: row.rowNumber,
          data: row.data,
          valid: row.valid,
          skipped: row.skipped,
          validationErrors: row.validationErrors,
        })),
        { ordered: true },
      );
    }
  } catch (error) {
    await QuestionImportRow.deleteMany({ importBatch: item._id });
    await QuestionImport.deleteOne({ _id: item._id });
    logger.error('Mock-test preview rows could not be saved', { ...uploadMeta, importId: String(item._id), error: error.message });
    throw error;
  }
  logger.info('Mock-test spreadsheet validation completed', {
    ...uploadMeta,
    importId: String(item._id),
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows - duplicateRows,
    duplicateRows,
  });
  console.log('[MockTest] spreadsheet validation completed', { requestId: req.requestId, importId: String(item._id), totalRows: rows.length, validRows, invalidRows: rows.length - validRows - duplicateRows, duplicateRows });
  return apiResponse.success(res, { message: 'Question file previewed', data: item });
});
const confirmQuestions = asyncHandler(async (req, res) => {
  console.log('[MockTest] import request received', { requestId: req.requestId, importId: req.params.id, userId: req.user?._id?.toString() });
  logger.info('Mock-test import started', { requestId: req.requestId, importId: req.params.id, userId: req.user?._id?.toString() });
  const batch = await QuestionImport.findById(req.params.id);
  if (!batch) {
    logger.warn('Mock-test import rejected', { requestId: req.requestId, importId: req.params.id, reason: 'import_not_found' });
    throw new AppError('Question import not found', 404);
  }
  await assertSubjectAccess(req, batch.subject);
  if (batch.status !== 'previewed') {
    logger.warn('Mock-test import rejected', { requestId: req.requestId, importId: String(batch._id), reason: 'already_processed', status: batch.status });
    throw new AppError('Question import is already processed', 409);
  }
  const toQuestion = (row) => {
    const d = row.data;
    return {
      course: batch.course,
      subject: d.subject || batch.subject,
      questionText: d.questionText,
      normalizedText: d.normalizedText,
      normalizedOptions: d.normalizedOptions,
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
      questionType: d.questionType,
      questionImage: d.questionImage,
      optionImages: { A: d.option1Image, B: d.option2Image, C: d.option3Image, D: d.option4Image },
      explanationImage: d.explanationImage,
      marks: d.marks,
      negativeMarks: d.negativeMarks,
      difficulty: ['easy', 'medium', 'hard'].includes(d.difficulty) ? d.difficulty : 'medium',
      chapter: d.chapter,
      topic: d.topic,
      status: d.status,
      importBatch: batch._id,
      createdBy: req.user._id,
    };
  };
  const inlineValidRows = batch.rows.filter((row) => row.valid);
  const hasValidRows = batch.hasExternalRows
    ? await QuestionImportRow.exists({ importBatch: batch._id, valid: true })
    : inlineValidRows.length > 0;
  if (!hasValidRows) {
    logger.warn('Mock-test import rejected', { requestId: req.requestId, importId: String(batch._id), reason: 'no_valid_rows' });
    throw new AppError('There are no valid rows to import', 400);
  }
  let imported = 0;
  const subjectIds = new Set();
  const saveQuestions = async (rowsToSave) => {
    const questions = rowsToSave.map(toQuestion);
    questions.forEach((question) => subjectIds.add(String(question.subject)));
    await Question.insertMany(questions, { ordered: true });
    imported += questions.length;
    console.log('[MockTest] question import batch saved', { requestId: req.requestId, importId: String(batch._id), batchRows: questions.length, imported });
    logger.info('Mock-test import batch saved', { requestId: req.requestId, importId: String(batch._id), batchRows: questions.length, imported });
  };
  if (batch.hasExternalRows) {
    let rowsToSave = [];
    const cursor = QuestionImportRow.find({ importBatch: batch._id, valid: true })
      .sort({ rowNumber: 1 })
      .cursor();
    for await (const row of cursor) {
      rowsToSave.push(row);
      if (rowsToSave.length === IMPORT_ROW_BATCH_SIZE) {
        await saveQuestions(rowsToSave);
        rowsToSave = [];
      }
    }
    if (rowsToSave.length) await saveQuestions(rowsToSave);
  } else {
    await saveQuestions(inlineValidRows);
  }
  // Keep the course subject list in sync with a multi-subject admin workbook.
  // Only existing Subject records are resolved during preview, so this cannot
  // create arbitrary subjects from spreadsheet text.
  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    await Course.findByIdAndUpdate(batch.course, {
      $addToSet: { subjects: { $each: [...subjectIds] } },
    });
  }
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
    newValue: { count: imported },
    ipAddress: req.ip,
  });
  await AcademyRecord.create({
    module: 'notification',
    title: 'New question bank available',
    description: `${imported} questions are ready to attempt.`,
    course: batch.course,
    subject: batch.subject,
    audience: 'students',
    status: 'active',
    payload: {
      type: 'question_bank_published',
      importBatchId: batch._id,
      questionCount: imported,
    },
  });
  logger.info('Mock-test import completed', { requestId: req.requestId, importId: String(batch._id), imported, rejected: batch.invalidRows, userId: req.user?._id?.toString() });
  console.log('[MockTest] import completed', { requestId: req.requestId, importId: String(batch._id), imported, rejected: batch.invalidRows });
  return apiResponse.success(res, {
    message: `${imported} questions imported`,
    data: { imported, rejected: batch.invalidRows },
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
  // Shuffle every question's options before sending it to a student. Keys stay stable for scoring.
  const randomizedItems = items.map((item) => ({ ...item.toObject(), options: shuffle(item.options || []) }));
  return apiResponse.success(res, { message: 'Questions fetched', data: randomizedItems });
});
const listMockTests = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.query.course);
  const filter = { course: req.query.course, status: 'imported' };
  if (req.query.subject) filter.subject = req.query.subject;
  const items = await QuestionImport.find(filter)
    .populate('subject', 'name subjectCode')
    .sort({ importedAt: -1, createdAt: -1 })
    .select('course subject originalFilename totalRows validRows importedAt createdAt');
  return apiResponse.success(res, {
    message: 'Mock tests fetched',
    data: items.map((item) => ({ ...item.toObject(), originalFilename: readableFilename(item.originalFilename) })),
  });
});
const mockTestQuestions = asyncHandler(async (req, res) => {
  const test = await QuestionImport.findById(req.params.id);
  if (!test || test.status !== 'imported') throw new AppError('Mock test not found', 404);
  await assertEnrollment(req, test.course);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = { importBatch: test._id, status: 'published', isDeleted: { $ne: true } };
  const [total, items] = await Promise.all([
    Question.countDocuments(filter),
    Question.find(filter)
    .select('-normalizedText')
    .sort({ createdAt: 1, _id: 1 })
    .skip((page - 1) * limit)
    .limit(limit),
  ]);
  return apiResponse.success(res, {
    message: 'Mock test questions fetched',
    data: items.map((item) => ({ ...item.toObject(), options: shuffle(item.options || []) })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
const mockTestProgress = asyncHandler(async (req, res) => {
  const test = await QuestionImport.findById(req.params.id);
  if (!test || test.status !== 'imported') throw new AppError('Mock test not found', 404);
  await assertEnrollment(req, test.course);
  const attempts = await QuestionAttempt.find({ student: req.user._id, mockTest: test._id, mockPage: { $exists: true } })
    .select('mockPage score maximumScore submittedAt updatedAt')
    .sort({ mockPage: 1 });
  return apiResponse.success(res, {
    message: 'Mock test progress fetched',
    data: attempts.map((attempt) => ({
      page: attempt.mockPage,
      score: attempt.score,
      maximumScore: attempt.maximumScore,
      submittedAt: attempt.submittedAt,
      updatedAt: attempt.updatedAt,
    })),
  });
});
const submitAnswers = asyncHandler(async (req, res) => {
  await assertEnrollment(req, req.body.course);
  const submittedAnswers = req.body.answers || [];
  if (!submittedAnswers.length) throw new AppError('At least one answer is required', 400);
  const isMockTestAttempt = Boolean(req.body.mockTest);
  const mockPage = Math.max(1, Number.parseInt(req.body.mockPage, 10) || 0);
  if (isMockTestAttempt && submittedAnswers.length > 20) {
    throw new AppError('A mock-test page can contain a maximum of 20 answers', 400);
  }
  const ids = submittedAnswers.map((answer) => String(answer.question));
  if (new Set(ids).size !== ids.length)
    throw new AppError('Each question can be answered only once', 400);
  const questionFilter = {
    course: req.body.course,
    subject: req.body.subject,
    status: 'published',
    isDeleted: { $ne: true },
    ...(isMockTestAttempt ? { importBatch: req.body.mockTest, _id: { $in: ids } } : {}),
  };
  if (isMockTestAttempt) {
    if (!req.body.mockPage) throw new AppError('Mock-test page is required', 400);
    const pageQuestions = await Question.find({
      importBatch: req.body.mockTest,
      course: req.body.course,
      subject: req.body.subject,
      status: 'published',
      isDeleted: { $ne: true },
    })
      .select('_id')
      .sort({ createdAt: 1, _id: 1 })
      .skip((mockPage - 1) * 20)
      .limit(20);
    if (pageQuestions.length !== ids.length || pageQuestions.some((question) => !ids.includes(String(question._id)))) {
      throw new AppError('Submit exactly one answer for each question on this mock-test page', 400);
    }
  }
  const questions = await Question.find(questionFilter).select('+correctOption +explanation');
  if (
    questions.length !== submittedAnswers.length ||
    questions.some((question) => !ids.includes(String(question._id))) ||
    (!isMockTestAttempt && questions.length !== submittedAnswers.length)
  ) {
    throw new AppError(isMockTestAttempt
      ? 'Submit exactly one answer for each question on this mock-test page'
      : 'Submit exactly one answer for every published question', 400);
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
  const attemptPayload = {
    student: req.user._id,
    course: req.body.course,
    subject: req.body.subject,
    ...(isMockTestAttempt ? { mockTest: req.body.mockTest, mockPage } : {}),
    answers,
    score,
    maximumScore,
    submittedAt: new Date(),
  };
  const attempt = isMockTestAttempt
    ? await QuestionAttempt.findOneAndUpdate(
        { student: req.user._id, mockTest: req.body.mockTest, mockPage },
        { $set: attemptPayload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    : await QuestionAttempt.create(attemptPayload);
  const resultPayload = {
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
    payload: {
      questionAttemptId: attempt._id,
      submittedAt: attempt.submittedAt,
      ...(isMockTestAttempt ? { mockTest: req.body.mockTest, mockPage } : {}),
    },
  };
  if (isMockTestAttempt) {
    await AcademyRecord.findOneAndUpdate(
      { module: 'result', student: req.user._id, 'payload.mockTest': req.body.mockTest, 'payload.mockPage': mockPage },
      { $set: resultPayload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    await AcademyRecord.create(resultPayload);
  }
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
  previewLearningFile,
  createLearningFile,
  importLearningFiles,
  updateLearningFile,
  removeLearningFile,
  questionTemplate,
  previewQuestions,
  confirmQuestions,
  listQuestions,
  submitAnswers,
  listMockTests,
  mockTestQuestions,
  mockTestProgress,
  _internals: { signDownload, verifyDownload, assertSubjectAccess, assertCourseSubject },
};
