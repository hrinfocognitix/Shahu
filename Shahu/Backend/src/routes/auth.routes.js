const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter, emailOtpIpLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  studentOtpSchema,
  refreshSchema,
  emailOtpRequestSchema,
  emailOtpVerifySchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/send-email-otp', emailOtpIpLimiter, validate(emailOtpRequestSchema), authController.sendEmailOtp);
router.post('/verify-email-otp', authLimiter, validate(emailOtpVerifySchema), authController.verifyEmailOtp);
router.post(
  '/student/request-otp',
  authLimiter,
  validate(loginSchema),
  authController.requestStudentOtp
);
router.post(
  '/student/verify-otp',
  authLimiter,
  validate(studentOtpSchema),
  authController.verifyStudentOtp
);
router.post('/student/forgot-password', authLimiter, validate(emailOtpRequestSchema), authController.requestStudentPasswordReset);
router.post('/forgot-password', authLimiter, validate(emailOtpRequestSchema), authController.requestStudentPasswordReset);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validate(refreshSchema), authController.logout);

module.exports = router;
