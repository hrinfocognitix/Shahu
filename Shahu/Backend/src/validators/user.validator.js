const Joi = require('joi');
const { ROLES } = require('../constants/roles');

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(80),
  role: Joi.string().valid(...Object.values(ROLES)),
  profile: Joi.object().unknown(true),
  isActive: Joi.boolean()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required()
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.when('role', {
    is: ROLES.TEACHER,
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().min(8).max(128).required()
  }),
  role: Joi.string().valid(ROLES.TEACHER, ROLES.STUDENT).required(),
  profile: Joi.object({
    phone: Joi.string().allow(''),
    address: Joi.string().allow(''),
    dateOfBirth: Joi.date(),
    experience: Joi.string().allow(''),
    qualification: Joi.string().allow(''),
    subjects: Joi.array().items(Joi.string().hex().length(24)).default([]),
    assignedSubjects: Joi.array().items(Joi.string().hex().length(24)).default([])
  }).unknown(true).default({})
});

module.exports = { updateUserSchema, updatePasswordSchema, createUserSchema };
