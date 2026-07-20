const Joi = require('joi');
const { ROLES } = require('../constants/roles');

const objectId = Joi.string().hex().length(24);
const contact = Joi.object({ name: Joi.string().allow(''), phone: Joi.string().allow(''), email: Joi.string().email().allow(''), relation: Joi.string().allow('') });
const profileUpdateSchema = Joi.object({
  phone: Joi.string().allow(''),
  mobile: Joi.string().allow(''),
  whatsapp: Joi.string().allow(''),
  photo: Joi.string().allow(''),
  address: Joi.string().allow(''),
  city: Joi.string().allow(''),
  state: Joi.string().allow(''),
  pinCode: Joi.string().allow(''),
  gender: Joi.string().valid('male', 'female', 'other'),
  dateOfBirth: Joi.date(),
  age: Joi.number().integer().min(0).max(120),
  qualification: Joi.string().allow(''),
  experience: Joi.string().allow(''),
  specialization: Joi.string().allow(''),
  subjects: Joi.array().items(objectId),
  designation: Joi.string().allow(''),
  biography: Joi.string().allow(''),
  joiningDate: Joi.date(),
  resume: Joi.string().allow(''),
  certificates: Joi.array().items(Joi.string()),
  documents: Joi.array().items(Joi.string()),
  parentDetails: contact,
  fatherName: Joi.string().allow(''),
  motherName: Joi.string().allow(''),
  guardianDetails: contact,
  emergencyContact: contact,
  assignedCourses: Joi.array().items(objectId),
  assignedSubjects: Joi.array().items(objectId),
  subjectDescriptions: Joi.array().items(Joi.object({ subject: objectId.required(), description: Joi.string().allow('') })),
  educationQualification: Joi.string().allow(''),
  schoolCollege: Joi.string().allow(''),
  currentClass: Joi.string().allow(''),
}).unknown(false);

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(80),
  profile: profileUpdateSchema,
  isActive: Joi.boolean()
}).unknown(false);

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
  profile: profileUpdateSchema.default({})
});

module.exports = { updateUserSchema, updatePasswordSchema, createUserSchema };
