const crypto = require('crypto');
const mongoose = require('mongoose');
const AcademyRecord = require('../models/AcademyRecord');
const AuditLog = require('../models/AuditLog');
const Course = require('../models/Course');
const CoursePurchaseOtp = require('../models/CoursePurchaseOtp');
const Enrollment = require('../models/Enrollment');
const PaymentIntent = require('../models/PaymentIntent');
const StudentDevice = require('../models/StudentDevice');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { hashPassword } = require('../helpers/bcrypt.helper');
const { sendEmail } = require('./email.service');
const { createReceiptPdf } = require('./receiptPdf.service');
const { createOrder, createSingleUseUpiQr, fetchQr, fetchQrPayments, fetchPayment, fetchOrderPayments, verifyCheckoutSignature, verifyWebhookSignature } = require('./payment.service');
const { ROLES } = require('../constants/roles');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { STATUS_CODES } = require('../constants/statusCodes');

const UPI_ID_PATTERN = /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/;
const PAYMENT_APPS = ['Google Pay', 'PhonePe', 'BHIM', 'Paytm', 'Bank UPI App', 'Other'];
const normalizeUpiId = value => String(value || '').trim().toLowerCase();
const isCompleteUpiId = value => UPI_ID_PATTERN.test(normalizeUpiId(value));
const formatAmount = value => Number(value || 0).toFixed(2);
const createTransactionReference = () => `SHAHU${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const hashAccessToken = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const normalizeUtr = value => String(value || '').replace(/\s+/g, '').toUpperCase();

const normalizedMobile = value => String(value || '').replace(/\D/g, '').slice(-10);

async function findBuyerStudent(buyer) {
  const mobile = normalizedMobile(buyer.mobileNo);
  const candidates = await User.find({
    role: ROLES.STUDENT,
    $or: [
      { email: buyer.email },
      ...(mobile ? [{ 'profile.mobile': mobile }, { 'profile.phone': mobile }] : []),
    ],
  }).select('email profile.mobile profile.phone');
  if (!candidates.length) return null;
  const student = candidates[0];
  const storedMobile = normalizedMobile(student.profile?.mobile || student.profile?.phone);
  if (student.email !== buyer.email || (mobile && storedMobile && storedMobile !== mobile)) {
    throw new AppError('This email address or mobile number already belongs to another student account.', STATUS_CODES.CONFLICT);
  }
  return student;
}

async function assertBuyerCanPurchaseCourse(courseId, buyer) {
  const student = await findBuyerStudent(buyer);
  if (!student) return null;
  if (buyer.deviceUuid) {
    const device = await StudentDevice.findOne({ uuid: buyer.deviceUuid }).select('student');
    if (device && String(device.student) !== String(student._id)) {
      throw new AppError('This mobile device is already registered to another student account.', STATUS_CODES.CONFLICT);
    }
  }
  const existingEnrollment = await Enrollment.exists({
    student: student._id,
    course: courseId,
  });
  if (existingEnrollment) {
    throw new AppError('This student already owns this course. Renew its validity instead of purchasing it again.', STATUS_CODES.CONFLICT);
  }
  return student;
}

async function loadVerifiedBuyer(courseId, email, body) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new AppError('Email is required.', STATUS_CODES.BAD_REQUEST);
  const otpBuyer = await CoursePurchaseOtp.findOne({ course: courseId, email: normalizedEmail }).lean();
  if (!otpBuyer?.verifiedAt || otpBuyer.expiresAt <= new Date()) {
    throw new AppError('Verify your email before creating a payment.', STATUS_CODES.UNAUTHORIZED);
  }
  return {
    email: normalizedEmail,
    name: String(otpBuyer?.name || body.name || '').trim(),
    mobileNo: String(otpBuyer?.mobileNo || body.mobileNo || '').trim(),
    age: Number(otpBuyer?.age || body.age) || undefined,
    education: String(otpBuyer?.education || body.education || '').trim(),
    address: String(otpBuyer?.address || body.address || '').trim(),
    deviceUuid: String(body.deviceUuid || '').trim(),
  };
}

function buildUpiUrl({ upiId, payeeName, transactionReference, amount }) {
  const query = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    tr: transactionReference,
    tn: 'Course Payment',
    am: formatAmount(amount),
    cu: 'INR',
  });
  return `upi://pay?${query.toString()}`;
}

function toPaymentResponse(intent, accountPayload = {}) {
  const paymentUrl = buildUpiUrl({
    upiId: intent.upiId,
    payeeName: intent.payeeName,
    transactionReference: intent.transactionReference,
    amount: intent.amount,
  });
  return {
    paymentId: String(intent._id),
    courseId: String(intent.course),
    courseName: intent.course?.name,
    amount: formatAmount(intent.amount),
    currency: intent.currency,
    upiId: intent.upiId,
    payeeName: intent.payeeName,
    // Reference-only field. It is never placed in the UPI pa parameter.
    registeredMobileNumber: String(accountPayload.mobileNo || accountPayload.registeredMobileNo || '').trim() || undefined,
    internalReference: intent.internalReference,
    transactionReference: intent.transactionReference,
    transactionNote: 'Course Payment',
    provider: 'upi',
    paymentUrl,
    qrCodeValue: paymentUrl,
    qrCodeImageUrl: accountPayload.isQrEnabled ? String(accountPayload.qrCode || '').trim() || undefined : undefined,
    paymentToken: intent.paymentToken,
  };
}

async function createUpiPaymentIntent(body) {
  const { courseId, paymentAccountId } = body;
  if (!courseId) throw new AppError('Course is required.', STATUS_CODES.BAD_REQUEST);
  const buyer = await loadVerifiedBuyer(courseId, body.email, body);
  const course = await Course.findOne({ _id: courseId, status: 'active', isDeleted: { $ne: true } })
    .select('name fees primaryPaymentAccount acceptedPaymentAccounts');
  if (!course) throw new AppError('Course not found.', STATUS_CODES.NOT_FOUND);
  await assertBuyerCanPurchaseCourse(course._id, buyer);

  const allowedAccountIds = [course.primaryPaymentAccount, ...(course.acceptedPaymentAccounts || [])]
    .filter(Boolean).map(String);
  const selectedAccountId = String(paymentAccountId || course.primaryPaymentAccount || '');
  if (!selectedAccountId || !allowedAccountIds.includes(selectedAccountId)) {
    throw new AppError('Select an active payment account assigned to this course.', STATUS_CODES.BAD_REQUEST);
  }
  const account = await AcademyRecord.findOne({ _id: selectedAccountId, module: 'payment-account', status: 'active', isDeleted: { $ne: true } });
  if (!account) throw new AppError('Payment account is unavailable.', STATUS_CODES.CONFLICT);
  const accountPayload = account.payload || {};
  const upiId = normalizeUpiId(accountPayload.upiId);
  if (!isCompleteUpiId(upiId)) {
    throw new AppError('The selected payment account has no valid complete UPI ID.', STATUS_CODES.CONFLICT);
  }
  if (String(accountPayload.paymentMode || 'direct-upi') === 'merchant-gateway') {
    throw new AppError('Merchant gateway checkout is not configured for this account yet.', STATUS_CODES.CONFLICT);
  }
  const amount = Number(course.fees || 0);
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const internalReference = createTransactionReference();
  const intent = await PaymentIntent.create({
    transactionReference: internalReference, internalReference, course: course._id, paymentAccount: account._id,
    email: buyer.email, buyer, provider: 'upi', paymentMode: 'direct-upi',
    merchantType: accountPayload.merchantType || 'personal', amount, amountMinor: Math.round(amount * 100),
    upiId, payeeName: String(accountPayload.merchantDisplayName || accountPayload.accountName || account.title || 'Course Payment').trim(),
    transactionNote: 'Course Payment', accessTokenHash: hashAccessToken(accessToken), status: 'PENDING_PAYMENT',
  });
  intent.paymentToken = accessToken;
  intent.course = course;
  return toPaymentResponse(intent, accountPayload);
}

async function requirePaymentAccess(paymentId, token) {
  if (!mongoose.isValidObjectId(paymentId)) throw new AppError('Payment not found.', STATUS_CODES.NOT_FOUND);
  const intent = await PaymentIntent.findById(paymentId).select('+accessTokenHash').populate('course', 'name');
  if (!intent || !token || !crypto.timingSafeEqual(Buffer.from(intent.accessTokenHash), Buffer.from(hashAccessToken(token)))) {
    throw new AppError('Payment not found.', STATUS_CODES.NOT_FOUND);
  }
  return intent;
}

// Creates a Razorpay single-use, fixed-price UPI QR. The amount always comes from Course.fees.
async function createRazorpayQrPayment(body) {
  if (!body.courseId) throw new AppError('Course is required.', STATUS_CODES.BAD_REQUEST);
  const buyer = await loadVerifiedBuyer(body.courseId, body.email, body);
  const course = await Course.findOne({ _id: body.courseId, status: 'active', isDeleted: { $ne: true } }).select('name fees primaryPaymentAccount');
  if (!course) throw new AppError('Course not found.', STATUS_CODES.NOT_FOUND);
  await assertBuyerCanPurchaseCourse(course._id, buyer);
  const amount = Number(course.fees || 0); const amountMinor = Math.round(amount * 100);
  if (amountMinor < 100) throw new AppError('Course price must be at least ₹1.00 for Razorpay.', STATUS_CODES.BAD_REQUEST);
  const account = course.primaryPaymentAccount ? await AcademyRecord.findOne({ _id: course.primaryPaymentAccount, module: 'payment-account', status: 'active', isDeleted: { $ne: true } }) : null;
  if (!account) throw new AppError('An active payment account is required for this course.', STATUS_CODES.CONFLICT);
  const internalReference = createTransactionReference();
  const closeBy = Math.floor(Date.now() / 1000) + (30 * 60);
  let qr;
    try {
      qr = await createSingleUseUpiQr({ name: `Course ${String(course.name).slice(0, 28)}`, amountMinor, description: 'Course Payment', closeBy, notes: { internal_reference: internalReference, course_id: String(course._id) } });
    } catch (_) { throw new AppError('Unable to create the Razorpay payment QR. Check Razorpay QR access and configuration.', STATUS_CODES.SERVICE_UNAVAILABLE); }
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Number(qr.close_by || closeBy) * 1000);
    const intent = await PaymentIntent.create({
      transactionReference: internalReference, internalReference, course: course._id, paymentAccount: account._id,
      email: buyer.email, buyer, provider: 'razorpay', paymentMode: 'merchant-gateway', merchantType: 'business', amount, amountMinor,
      upiId: 'razorpay-qr@razorpay', payeeName: 'Razorpay', transactionNote: 'Course Payment', accessTokenHash: hashAccessToken(accessToken), status: 'PENDING',
      razorpay: { qrId: qr.id, qrImageUrl: qr.image_url, qrContent: qr.image_content, expiresAt },
    });
    return { paymentId: String(intent._id), courseId: String(course._id), courseName: course.name, amount: formatAmount(amount), amountMinor, currency: 'INR', provider: 'razorpay', status: 'PENDING', upiId: '', payeeName: 'Razorpay', transactionReference: internalReference, transactionNote: 'Course Payment', paymentUrl: '', internalReference, qrId: qr.id, qrImageUrl: qr.image_url, qrCodeValue: qr.image_content || qr.image_url, expiresAt: expiresAt.toISOString(), paymentToken: accessToken };
  }

  async function createRazorpayCheckoutOrder(body) {
    if (!body.courseId) throw new AppError('Course is required.', STATUS_CODES.BAD_REQUEST);
    const buyer = await loadVerifiedBuyer(body.courseId, body.email, body);
    const course = await Course.findOne({ _id: body.courseId, status: 'active', isDeleted: { $ne: true } }).select('name fees primaryPaymentAccount');
    if (!course) throw new AppError('Course not found.', STATUS_CODES.NOT_FOUND);
    await assertBuyerCanPurchaseCourse(course._id, buyer);
    const account = course.primaryPaymentAccount ? await AcademyRecord.findOne({ _id: course.primaryPaymentAccount, module: 'payment-account', status: 'active', isDeleted: { $ne: true } }) : null;
    if (!account) throw new AppError('An active payment account is required for this course.', STATUS_CODES.CONFLICT);
    const amount = Number(course.fees || 0); const amountMinor = Math.round(amount * 100);
    if (amountMinor < 100) throw new AppError('Course price must be at least ₹1.00.', STATUS_CODES.BAD_REQUEST);
    const internalReference = createTransactionReference();
    let order;
  try {
    order = await createOrder({
      amount: amountMinor,
      currency: 'INR',
      receipt: internalReference.slice(0, 40),
    });
  } catch (err) {
    console.error('========== RAZORPAY ORDER ERROR ==========');
    console.error(err);
    console.error('Status:', err.statusCode);
    console.error('Error:', err.error);
    console.error('Description:', err.description);
    console.error('Message:', err.message);
    console.error('==========================================');
    throw new AppError('Unable to create Razorpay order.', STATUS_CODES.SERVICE_UNAVAILABLE);
  }
    if (order?.skipped || !order?.id) throw new AppError('Razorpay is not configured.', STATUS_CODES.SERVICE_UNAVAILABLE);
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const intent = await PaymentIntent.create({
      transactionReference: internalReference, internalReference, course: course._id, paymentAccount: account._id, email: buyer.email, buyer,
      provider: 'razorpay', paymentMode: 'merchant-gateway', merchantType: 'business', amount, amountMinor, upiId: 'razorpay-checkout@razorpay',
      payeeName: 'Razorpay', transactionNote: 'Course Payment', accessTokenHash: hashAccessToken(accessToken), status: 'PENDING', razorpay: { orderId: order.id },
    });
    return { paymentId: String(intent._id), paymentToken: accessToken, keyId: env.razorpay.keyId, order_id: order.id, amount: order.amount, currency: order.currency, courseName: course.name, internalReference };
  }

async function verifyRazorpayCheckoutPayment(paymentId, token, body) {
    const orderId = String(body.razorpay_order_id || '').trim(); const razorpayPaymentId = String(body.razorpay_payment_id || '').trim(); const signature = String(body.razorpay_signature || '').trim();
    if (!orderId || !razorpayPaymentId || !signature) throw new AppError('Payment verification details are required.', STATUS_CODES.BAD_REQUEST);
    const intent = await requirePaymentAccess(paymentId, token);
    if (intent.provider !== 'razorpay' || intent.razorpay?.orderId !== orderId) throw new AppError('Payment verification failed.', STATUS_CODES.BAD_REQUEST);
    if (intent.status === 'PAID' && intent.enrollment) return { status: 'PAID', paymentId: String(intent._id) };
    if (intent.status !== 'PENDING' || !verifyCheckoutSignature({ orderId, paymentId: razorpayPaymentId, signature })) throw new AppError('Payment signature verification failed.', STATUS_CODES.BAD_REQUEST);
    let payment;
    try { payment = await fetchPayment(razorpayPaymentId); } catch (_) { throw new AppError('Unable to verify the payment with Razorpay.', STATUS_CODES.SERVICE_UNAVAILABLE); }
    if (payment.order_id !== orderId || Number(payment.amount) !== Number(intent.amountMinor) || payment.currency !== 'INR' || payment.status !== 'captured') throw new AppError('Payment is not captured or does not match this order.', STATUS_CODES.BAD_REQUEST);
    intent.status = 'PAID'; intent.razorpay.paymentId = razorpayPaymentId; intent.razorpay.signature = signature; intent.razorpay.paidAt = new Date(); await intent.save();
    const approval = await approvePayment(intent._id, { role: 'system' }, 'razorpay-checkout', { expectedStatus: 'PAID', finalStatus: 'PAID', auditAction: 'razorpay_checkout_verified', reason: 'Verified Razorpay Standard Checkout signature and captured payment' });
    return { status: 'PAID', paymentId: String(intent._id), emailDelivery: approval.emailDelivery };
  }

async function reconcileRazorpayPayment(paymentId, token) {
  const intent = await requirePaymentAccess(paymentId, token);
  if (intent.provider !== 'razorpay') throw new AppError('This is not a Razorpay payment.', STATUS_CODES.BAD_REQUEST);
  if (intent.status === 'PAID' && intent.enrollment) return { paymentId: String(intent._id), status: 'PAID', paidAt: intent.razorpay?.paidAt || null };
  if (intent.razorpay?.expiresAt && intent.razorpay.expiresAt < new Date()) { intent.status = 'EXPIRED'; await intent.save(); return { paymentId: String(intent._id), status: 'EXPIRED' }; }
  // Standard Checkout orders are reconciled by their order ID, not QR APIs.
  if (intent.razorpay?.orderId) {
    let payment;
    try {
      if (intent.razorpay.paymentId) payment = await fetchPayment(intent.razorpay.paymentId);
      else {
        const result = await fetchOrderPayments(intent.razorpay.orderId);
        payment = (result?.items || []).find(item => item.order_id === intent.razorpay.orderId && Number(item.amount) === Number(intent.amountMinor) && item.currency === 'INR' && item.status === 'captured');
      }
    } catch (_) { return { paymentId: String(intent._id), status: 'PENDING' }; }
    if (!payment || payment.order_id !== intent.razorpay.orderId || Number(payment.amount) !== Number(intent.amountMinor) || payment.currency !== 'INR' || payment.status !== 'captured') {
      return { paymentId: String(intent._id), status: 'PENDING' };
    }
    intent.status = 'PAID'; intent.razorpay.paymentId = payment.id; intent.razorpay.paidAt = new Date(); await intent.save();
    await approvePayment(intent._id, { role: 'system' }, 'razorpay-reconcile', { expectedStatus: 'PAID', finalStatus: 'PAID', auditAction: 'razorpay_payment_reconciled', reason: 'Captured Razorpay order reconciled by backend' });
    return { paymentId: String(intent._id), status: 'PAID', paidAt: intent.razorpay.paidAt };
  }
    const [qr, payments] = await Promise.all([fetchQr(intent.razorpay.qrId), fetchQrPayments(intent.razorpay.qrId)]);
    const payment = (payments?.items || []).find(item => item.status === 'captured' && Number(item.amount) === Number(intent.amountMinor));
    if (!payment || Number(qr.payments_amount_received || 0) !== Number(intent.amountMinor)) return { paymentId: String(intent._id), status: 'PENDING', expiresAt: intent.razorpay.expiresAt };
    intent.status = 'PAID'; intent.razorpay.paymentId = payment.id; intent.razorpay.paidAt = new Date(); await intent.save();
    await approvePayment(intent._id, { role: 'system' }, 'razorpay-api', { expectedStatus: 'PAID', finalStatus: 'PAID', auditAction: 'razorpay_payment_verified', reason: 'Verified through Razorpay API' });
    return { paymentId: String(intent._id), status: 'PAID', paidAt: intent.razorpay.paidAt };
  }

async function processRazorpayWebhook(rawBody, headers) {
  if (!verifyWebhookSignature(rawBody, headers['x-razorpay-signature'])) throw new AppError('Invalid webhook signature.', STATUS_CODES.UNAUTHORIZED);
  const eventId = String(headers['x-razorpay-event-id'] || ''); const event = JSON.parse(rawBody.toString('utf8'));
  if (!['payment.captured', 'order.paid', 'qr_code.credited'].includes(event.event)) return { ignored: true };
  const payment = event.payload?.payment?.entity; const qr = event.payload?.qr_code?.entity;
  if (!payment || payment.status !== 'captured' || payment.currency !== 'INR') return { ignored: true };
  const intent = await PaymentIntent.findOne({
    provider: 'razorpay',
    $or: [
      { 'razorpay.orderId': payment.order_id },
      ...(qr?.id ? [{ 'razorpay.qrId': qr.id }] : []),
    ],
  });
  if (!intent || Number(payment.amount) !== Number(intent.amountMinor)) return { ignored: true };
  if (eventId && intent.razorpay.webhookEventIds.includes(eventId)) return { duplicate: true };
  const updated = await PaymentIntent.findOneAndUpdate(
    { _id: intent._id, status: { $in: ['PENDING', 'VERIFICATION_PENDING'] }, ...(eventId ? { 'razorpay.webhookEventIds': { $ne: eventId } } : {}) },
      { $set: { status: 'PAID', 'razorpay.paymentId': payment.id, 'razorpay.paidAt': new Date() }, ...(eventId ? { $addToSet: { 'razorpay.webhookEventIds': eventId } } : {}) }, { returnDocument: 'after' }
    );
  if (updated) await approvePayment(updated._id, { role: 'system' }, 'razorpay-webhook', { expectedStatus: 'PAID', finalStatus: 'PAID', auditAction: 'razorpay_payment_verified', reason: 'Verified Razorpay webhook' });
  return { processed: Boolean(updated), paymentId: String(intent._id), status: updated?.status || intent.status };
}

async function markRazorpayCheckoutFailed(paymentId, token, body) {
  const intent = await requirePaymentAccess(paymentId, token);
  if (intent.provider !== 'razorpay') throw new AppError('This is not a Razorpay payment.', STATUS_CODES.BAD_REQUEST);
  if (intent.status === 'PAID') return { paymentId: String(intent._id), status: 'PAID' };
  if (intent.status !== 'PENDING') return { paymentId: String(intent._id), status: intent.status };
  // A client dismissal can race a completed payment. Confirm Razorpay has not captured it first.
  if (intent.razorpay?.orderId) {
    try {
      const result = await fetchOrderPayments(intent.razorpay.orderId);
      const captured = (result?.items || []).find(item => item.order_id === intent.razorpay.orderId && Number(item.amount) === Number(intent.amountMinor) && item.currency === 'INR' && item.status === 'captured');
      if (captured) {
        intent.status = 'PAID'; intent.razorpay.paymentId = captured.id; intent.razorpay.paidAt = new Date(); await intent.save();
        await approvePayment(intent._id, { role: 'system' }, 'razorpay-failure-reconcile', { expectedStatus: 'PAID', finalStatus: 'PAID', auditAction: 'razorpay_payment_reconciled', reason: 'Captured payment found after client checkout dismissal' });
        return { paymentId: String(intent._id), status: 'PAID' };
      }
    } catch (_) { return { paymentId: String(intent._id), status: 'PENDING' }; }
  }
  intent.status = body?.cancelled ? 'CANCELLED' : 'FAILED';
  intent.rejectionReason = String(body?.description || body?.message || 'Razorpay checkout was not completed.').trim().slice(0, 500);
  await intent.save();
  return { paymentId: String(intent._id), status: 'FAILED' };
}

async function submitPaymentProof(paymentId, token, body) {
  const utrNumber = normalizeUtr(body.utrNumber);
  if (!utrNumber || !/^[A-Z0-9-]{6,64}$/.test(utrNumber)) throw new AppError('A valid UTR / transaction ID is required.', STATUS_CODES.BAD_REQUEST);
  if (!PAYMENT_APPS.includes(String(body.paymentApp || ''))) throw new AppError('Select the UPI app used for payment.', STATUS_CODES.BAD_REQUEST);
  const intent = await requirePaymentAccess(paymentId, token);
  if (intent.status !== 'PENDING_PAYMENT') throw new AppError('This payment can no longer be submitted.', STATUS_CODES.CONFLICT);
  const duplicate = await PaymentIntent.exists({ utrNumber, _id: { $ne: intent._id } });
  if (duplicate) throw new AppError('This UTR / transaction ID was already submitted.', STATUS_CODES.CONFLICT);
  intent.utrNumber = utrNumber;
  intent.paymentApp = body.paymentApp;
  intent.paymentScreenshotUrl = String(body.paymentScreenshotUrl || '').trim() || undefined;
  intent.userNote = String(body.userNote || '').trim() || undefined;
  intent.status = 'PENDING_VERIFICATION';
  intent.submittedAt = new Date();
  try { await intent.save(); } catch (error) {
    if (error?.code === 11000) throw new AppError('This UTR / transaction ID was already submitted.', STATUS_CODES.CONFLICT);
    throw error;
  }
  return { status: intent.status, message: 'Your payment was submitted for verification.' };
}

async function getPaymentStatus(paymentId, token) {
  const intent = await requirePaymentAccess(paymentId, token);
  return { paymentId: String(intent._id), status: intent.status, rejectionReason: intent.rejectionReason || null, verifiedAt: intent.verifiedAt || null };
}

async function listAdminPayments(status) {
  const filter = status ? { status: String(status).toUpperCase() } : {};
  return PaymentIntent.find(filter).populate('course', 'name').populate('paymentAccount', 'title').populate('verifiedBy', 'name email').sort({ submittedAt: -1, createdAt: -1 }).lean();
}

async function approvePayment(paymentId, admin, ip, options = {}) {
  const intent = await PaymentIntent.findById(paymentId).populate('course').populate('paymentAccount');
  if (!intent) throw new AppError('Payment not found.', STATUS_CODES.NOT_FOUND);
  const expectedStatus = options.expectedStatus || 'PENDING_VERIFICATION';
  const finalStatus = options.finalStatus || 'VERIFIED';
  if (intent.status === finalStatus && intent.enrollment) return { intent, alreadyVerified: true };
  if (intent.status !== expectedStatus) throw new AppError('This payment cannot be approved in its current state.', STATUS_CODES.CONFLICT);
  let session = await mongoose.startSession();
  let enrollment;
  let student;
  let transaction;
  let enrolledCourse;
  let temporaryPassword;
  const activateEnrollment = async () => {
      const locked = await PaymentIntent.findOneAndUpdate(
        { _id: intent._id, status: expectedStatus },
        { $set: { status: finalStatus, verifiedBy: admin._id, verifiedAt: new Date() } },
        { returnDocument: 'after', session }
      );
      if (!locked) return;
      student = await User.findOne({ email: locked.email }).session(session);
      if (!student) {
        temporaryPassword = crypto.randomBytes(9).toString('base64url');
        [student] = await User.create([{ name: locked.buyer?.name || locked.email, email: locked.email,
          password: await hashPassword(temporaryPassword), role: ROLES.STUDENT, mustChangePassword: false,
          profile: { phone: locked.buyer?.mobileNo, mobile: locked.buyer?.mobileNo, address: locked.buyer?.address, age: locked.buyer?.age, educationQualification: locked.buyer?.education, admissionDate: new Date(), paymentStatus: 'successful', studentStatus: 'active' }, createdBy: admin._id, updatedBy: admin._id }], { session });
      }
      enrolledCourse = await Course.findById(locked.course).session(session);
      const now = new Date(); const validityDays = Math.max(1, Number(enrolledCourse.durationDays || 1)); const validUntil = new Date(now); validUntil.setUTCDate(validUntil.getUTCDate() + validityDays);
      [transaction] = await Transaction.create([{ purchaseId: `MAN-${locked.transactionReference}`, transactionReference: locked.transactionReference,
        idempotencyKey: `manual-intent:${locked._id}`, course: enrolledCourse._id, paymentAccount: locked.paymentAccount,
        student: student._id,
        buyer: { name: locked.buyer?.name || locked.email, email: locked.email, mobileNo: locked.buyer?.mobileNo || 'Not provided', deviceUuid: locked.buyer?.deviceUuid, age: locked.buyer?.age, education: locked.buyer?.education, address: locked.buyer?.address },
        pricing: { payablePrice: locked.amount, paidAmount: locked.amount, payablePriceMinor: locked.amountMinor, paidAmountMinor: locked.amountMinor }, paymentMethod: `UPI - ${locked.paymentApp}`, gatewayReference: locked.utrNumber, submittedFrom: 'android', status: 'successful', paymentDate: locked.submittedAt, verifiedAt: new Date(), verifiedBy: admin._id, note: locked.userNote }], { session });
      enrollment = await Enrollment.findOneAndUpdate({ student: student._id, course: enrolledCourse._id, status: 'active' },
        { $setOnInsert: { student: student._id, course: enrolledCourse._id, transaction: transaction._id, purchaseDate: now, validFrom: now, validUntil, validityDays, status: 'active', validityMode: 'automatic', createdBy: admin._id }, $set: { updatedBy: admin._id } },
        { upsert: true, returnDocument: 'after', runValidators: true, session });
      await PaymentIntent.findByIdAndUpdate(locked._id, { $set: { enrollment: enrollment._id, transaction: transaction._id, userId: student._id } }, { session });
      await User.findByIdAndUpdate(student._id, { $addToSet: { 'profile.purchasedCourses': enrolledCourse._id }, $set: { 'profile.paymentStatus': 'successful', updatedBy: admin._id } }, { session });
      if (locked.buyer?.deviceUuid) {
        await StudentDevice.findOneAndUpdate(
          { uuid: locked.buyer.deviceUuid },
          { $set: { student: student._id, lastSeenAt: new Date(), isActive: true } },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
        );
      }
      await AuditLog.create([{ user: admin._id, role: admin.role, action: options.auditAction || 'manual_upi_payment_approved', module: 'payment-intents', recordId: locked._id, newValue: { status: finalStatus, enrollment: enrollment._id }, reason: options.reason || 'Payment manually verified in receiving account', ipAddress: ip }], { session });
  };
  try {
    await session.withTransaction(activateEnrollment);
  } catch (error) {
    // Local MongoDB commonly runs standalone and may reject either transactions
    // or retryable writes before the transaction callback can complete.
    const unsupportedTransactions = /transaction numbers are only allowed|does not support (?:transactions|retryable writes)|retrywrites=false|replica set/i.test(String(error?.message || ''));
    if (!unsupportedTransactions) throw error;
    await session.endSession();
    session = null;
    await activateEnrollment();
  } finally {
    if (session) await session.endSession();
  }
  const verified = await PaymentIntent.findById(paymentId);
  let emailDelivery = { sent: false, reason: 'No receipt was generated.' };
  // Send credentials and receipt only after the database write commits. Delivery failure never
  // reverses an approved payment; a password reset remains available to the student.
  if (transaction && enrollment && student && enrolledCourse) {
    try {
      transaction.receiptNumber = transaction.receiptNumber || `RCP-${transaction.purchaseId}`;
      const receiptPdf = createReceiptPdf({ receiptNumber: transaction.receiptNumber, purchaseId: transaction.purchaseId, student, course: enrolledCourse, transaction, enrollment });
      const passwordDetails = temporaryPassword
        ? `\n\nLogin ID: ${student.email} or ${student.profile?.mobile || student.profile?.phone}.\nTemporary password: ${temporaryPassword}\nYou may change your password later from the app.`
        : '';
      const transactionId = transaction.gatewayReference || transaction.transactionReference || transaction.purchaseId;
      const delivery = await sendEmail({
        to: verified.email,
        subject: `Payment successful — ${enrolledCourse.name} | Lokaraja Career Academy`,
        text: `Dear ${student.name || 'Student'},\n\nThank you for your purchase. Your payment was successful and ${enrolledCourse.name} is now active.\nTransaction ID: ${transactionId}\nReceipt number: ${transaction.receiptNumber}\n\nप्रिय विद्यार्थी,\nतुमची फी यशस्वीरीत्या प्राप्त झाली आहे. ${enrolledCourse.name} हा कोर्स आता तुमच्या खात्यात सक्रिय आहे.\nव्यवहार क्रमांक: ${transactionId}\nपावती क्रमांक: ${transaction.receiptNumber}${passwordDetails}\n\nYour payment receipt is attached. / तुमची पावती जोडलेली आहे.`,
        html: `<p>Dear ${student.name || 'Student'},</p><p>Thank you for your purchase. Your payment was successful and <strong>${enrolledCourse.name}</strong> is now active.</p><p><strong>Transaction ID:</strong> ${transactionId}<br/><strong>Receipt number:</strong> ${transaction.receiptNumber}</p><hr/><p>प्रिय विद्यार्थी,</p><p>तुमची फी यशस्वीरीत्या प्राप्त झाली आहे. <strong>${enrolledCourse.name}</strong> हा कोर्स आता तुमच्या खात्यात सक्रिय आहे.</p><p><strong>व्यवहार क्रमांक:</strong> ${transactionId}<br/><strong>पावती क्रमांक:</strong> ${transaction.receiptNumber}</p>${temporaryPassword ? `<hr/><p><strong>Login ID:</strong> ${student.email} or ${student.profile?.mobile || student.profile?.phone}<br/><strong>Temporary password:</strong> ${temporaryPassword}</p><p>Please sign in and change this password immediately.</p>` : ''}<p>Your payment receipt is attached. / तुमची पावती जोडलेली आहे.</p>`,
        attachments: [{ filename: `${transaction.receiptNumber}.pdf`, content: receiptPdf, contentType: 'application/pdf' }],
      });
      if (delivery?.skipped) throw new Error('Email delivery is not configured');
      transaction.receiptEmailedAt = new Date();
      transaction.receiptEmailError = undefined;
      emailDelivery = { sent: true, reason: null };
    } catch (error) {
      transaction.receiptEmailError = String(error.message || 'Receipt email failed');
      emailDelivery = { sent: false, reason: transaction.receiptEmailError };
    }
    await transaction.save();
  }
  return { intent: verified, enrollment, alreadyVerified: false, emailDelivery };
}

async function rejectPayment(paymentId, admin, reason, ip) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new AppError('A rejection reason is required.', STATUS_CODES.BAD_REQUEST);
  const intent = await PaymentIntent.findById(paymentId);
  if (!intent) throw new AppError('Payment not found.', STATUS_CODES.NOT_FOUND);
  if (intent.status === 'REJECTED') return intent;
  if (intent.status !== 'PENDING_VERIFICATION') throw new AppError('Only submitted payments can be rejected.', STATUS_CODES.CONFLICT);
  intent.status = 'REJECTED'; intent.rejectionReason = cleanReason; intent.verifiedBy = admin._id; intent.verifiedAt = new Date(); await intent.save();
  await AuditLog.create({ user: admin._id, role: admin.role, action: 'manual_upi_payment_rejected', module: 'payment-intents', recordId: intent._id, newValue: { status: 'REJECTED' }, reason: cleanReason, ipAddress: ip });
  return intent;
}

module.exports = { createUpiPaymentIntent, createRazorpayQrPayment, createRazorpayCheckoutOrder, verifyRazorpayCheckoutPayment, markRazorpayCheckoutFailed, reconcileRazorpayPayment, processRazorpayWebhook, submitPaymentProof, getPaymentStatus, listAdminPayments, approvePayment, rejectPayment, isCompleteUpiId, normalizeUpiId, normalizeUtr, buildUpiUrl, PAYMENT_APPS };
