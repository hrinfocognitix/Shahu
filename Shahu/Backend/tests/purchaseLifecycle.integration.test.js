const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');
const ExcelJS = require('exceljs');

jest.mock('../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ skipped: true, reason: 'disabled in integration tests' }),
}));

const app = require('../src/app');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Subject = require('../src/models/Subject');
const Transaction = require('../src/models/Transaction');
const Enrollment = require('../src/models/Enrollment');
const AcademyRecord = require('../src/models/AcademyRecord');
const AuditLog = require('../src/models/AuditLog');
const Question = require('../src/models/Question');
const QuestionImport = require('../src/models/QuestionImport');
const { signAccessToken } = require('../src/helpers/jwt.helper');
const { ROLES } = require('../src/constants/roles');

jest.setTimeout(60000);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function connectEventually(uri, attempts = 40) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 });
      return;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  throw lastError;
}

describe('course purchase lifecycle (isolated Mongo replica set)', () => {
  let mongoProcess;
  let databaseDirectory;
  let admin;
  let token;
  let course;
  let subject;
  const uploadedFiles = [];

  beforeAll(async () => {
    const port = await unusedPort();
    databaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shahu-purchase-test-'));
    mongoProcess = spawn(
      'mongod',
      ['--dbpath', databaseDirectory, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'rs0', '--quiet'],
      { stdio: 'ignore' }
    );
    const directUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
    await connectEventually(directUri);
    await mongoose.connection.db.admin().command({
      replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });
    await mongoose.disconnect();
    await connectEventually(`mongodb://127.0.0.1:${port}/shahu_purchase_test?replicaSet=rs0`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (hello.isWritablePrimary) break;
      await delay(150);
    }
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

    admin = await User.create({
      name: 'Purchase Admin', email: 'purchase-admin@example.test', password: 'hashed-for-test',
      role: ROLES.ADMIN, mustChangePassword: false, authVersion: 0,
    });
    token = signAccessToken({ sub: String(admin._id), role: admin.role, sv: 0 });
    course = await Course.create({
      name: 'Integrated Course', actualPrice: 2000, discountType: 'percentage',
      discountValue: 25, durationDays: 30, status: 'active',
    });
    subject = await Subject.create({ name: 'Integrated Mathematics', course: course._id });
    course.subjects = [subject._id];
    await course.save();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    if (mongoProcess && !mongoProcess.killed) mongoProcess.kill('SIGTERM');
    uploadedFiles.forEach((filename) => {
      const uploadPath = path.join(__dirname, '../src/uploads', path.basename(filename));
      if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
    });
    if (databaseDirectory) fs.rmSync(databaseDirectory, { recursive: true, force: true });
  });

  const purchasePayload = (reference) => ({
    courseId: String(course._id), name: 'New Student', email: `${reference}@example.test`,
    age: 20, education: 'Graduate', address: 'Kolhapur', mobileNo: `90000${reference.slice(-5)}`,
    deviceUuid: `android-${reference}`, transactionId: reference, paymentMethod: 'UPI',
    paymentDate: '2026-07-01T00:00:00.000Z',
  });

  it('creates one pending transaction for duplicate Android submissions', async () => {
    const payload = purchasePayload('TXN10001');
    const first = await request(app).post('/api/v1/course-purchases')
      .set('X-Client-Platform', 'android').set('Idempotency-Key', 'purchase-10001').send(payload);
    const duplicate = await request(app).post('/api/v1/course-purchases')
      .set('X-Client-Platform', 'android').set('Idempotency-Key', 'purchase-10001').send(payload);

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(200);
    expect(String(duplicate.body.data._id)).toBe(String(first.body.data._id));
    expect(await Transaction.countDocuments({ transactionReference: 'TXN10001' })).toBe(1);
    expect(await AcademyRecord.countDocuments({ module: 'course-purchase' })).toBe(1);
  });

  it('verifies once, creates the student and enrollment, and supports audited manual validity', async () => {
    const transaction = await Transaction.findOne({ transactionReference: 'TXN10001' });
    const verified = await request(app)
      .patch(`/api/v1/course-purchases/transactions/${transaction._id}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'successful', reason: 'Bank reference checked' });
    const repeated = await request(app)
      .patch(`/api/v1/course-purchases/transactions/${transaction._id}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'successful' });

    expect(verified.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(await Enrollment.countDocuments({ transaction: transaction._id })).toBe(1);
    const enrollment = await Enrollment.findOne({ transaction: transaction._id });
    expect(enrollment.validityDays).toBe(30);
    expect(enrollment.validUntil.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(await User.countDocuments({ email: 'txn10001@example.test', role: ROLES.STUDENT })).toBe(1);

    const studentToken = signAccessToken({
      sub: String(verified.body.data.student._id), role: ROLES.STUDENT, sv: 0,
    });
    const passwordUpdate = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ currentPassword: verified.body.data.temporaryPassword, newPassword: 'Student-Password-2026' });
    expect(passwordUpdate.status).toBe(200);
    expect((await User.findById(verified.body.data.student._id)).mustChangePassword).toBe(false);

    const validity = await request(app)
      .patch(`/api/v1/course-purchases/enrollments/${enrollment._id}/validity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ validFrom: '2026-07-05', validUntil: '2026-08-20', reason: 'Approved extension' });
    expect(validity.status).toBe(200);
    expect(validity.body.data.validityMode).toBe('manual');
    expect(validity.body.data.validityHistory).toHaveLength(1);
    expect(await AuditLog.countDocuments({ action: 'validity_overridden', recordId: enrollment._id })).toBe(1);
  });

  it('records a failed verification without creating a student or enrollment', async () => {
    const created = await request(app).post('/api/v1/course-purchases')
      .set('X-Client-Platform', 'android').send(purchasePayload('TXN10002'));
    const failed = await request(app)
      .patch(`/api/v1/course-purchases/transactions/${created.body.data._id}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'failed', reason: 'Reference not found' });

    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe('failed');
    expect(await Enrollment.countDocuments({ transaction: created.body.data._id })).toBe(0);
    expect(await User.countDocuments({ email: 'txn10002@example.test' })).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'payment_failed', recordId: created.body.data._id })).toBe(1);
  });

  it('previews XLSX validation and imports only valid questions once', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Questions');
    sheet.addRow([
      'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option',
      'Explanation', 'Marks', 'Negative Marks', 'Difficulty', 'Chapter', 'Topic',
    ]);
    sheet.addRow(['What is 2 + 2?', '3', '4', '', '', 'B', 'Basic addition', 1, 0, 'easy', 'Arithmetic', 'Addition']);
    sheet.addRow(['What is 2 + 2?', 'Three', 'Four', '', '', 'B', '', 1, 0, 'easy', 'Arithmetic', 'Addition']);
    sheet.addRow(['Invalid answer row', 'One', 'Two', '', '', 'D', '', 1, 0, 'medium', 'Validation', 'Options']);
    const buffer = await workbook.xlsx.writeBuffer();

    const preview = await request(app)
      .post('/api/v1/learning/questions/preview')
      .set('Authorization', `Bearer ${token}`)
      .field('course', String(course._id))
      .field('subject', String(subject._id))
      .attach('file', Buffer.from(buffer), {
        filename: 'question-import.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ totalRows: 3, validRows: 2, invalidRows: 1, status: 'previewed' });
    uploadedFiles.push(preview.body.data.storedFilename);
    const differentOptionsRow = preview.body.data.rows.find((row) => row.rowNumber === 3);
    expect(differentOptionsRow.valid).toBe(true);

    const confirmed = await request(app)
      .post(`/api/v1/learning/questions/import/${preview.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    const repeated = await request(app)
      .post(`/api/v1/learning/questions/import/${preview.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data).toEqual({ imported: 2, rejected: 1 });
    expect(repeated.status).toBe(409);
    expect(await Question.countDocuments({ course: course._id, subject: subject._id })).toBe(2);
    expect(await QuestionImport.countDocuments({ _id: preview.body.data._id, status: 'imported' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'questions_imported', recordId: preview.body.data._id })).toBe(1);
  });
});
