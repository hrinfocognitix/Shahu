const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  studentOtpSchema,
  refreshSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
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
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validate(refreshSchema), authController.logout);

module.exports = router;
