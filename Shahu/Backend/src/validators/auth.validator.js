const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email(),
  identifier: Joi.string().trim().min(3).max(254),
  password: Joi.string().required(),
}).or('email', 'identifier');

const studentOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const emailOtpRequestSchema = Joi.object({ email: Joi.string().email().max(254).required() });
const emailOtpVerifySchema = Joi.object({
  email: Joi.string().email().max(254).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
});

module.exports = { registerSchema, loginSchema, studentOtpSchema, refreshSchema, emailOtpRequestSchema, emailOtpVerifySchema };
