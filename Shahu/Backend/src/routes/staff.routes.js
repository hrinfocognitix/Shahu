const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const validate = require('../middleware/validation.middleware');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');

function usersByRole(role, { allowCreate = true } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.get('/', authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.SUPERADMIN), (req, res, next) => { req.query.role = role; return userController.listUsers(req, res, next); });
  if (allowCreate) router.post('/', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), (req, res, next) => {
    req.body.role = role;
    return next();
  }, validate(createUserSchema), userController.createUser);
  router.patch('/:id', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), (req, res, next) => {
    delete req.body.role;
    delete req.body.email;
    if (role === ROLES.STUDENT && req.body.profile) {
      const editableProfile = { ...req.body.profile };
      delete editableProfile.mobile;
      delete editableProfile.phone;
      delete editableProfile.deviceUuid;
      delete editableProfile.purchasedCourses;
      delete editableProfile.paymentStatus;
      delete editableProfile.feeDetails;
      delete editableProfile.enrolledCourse;
      delete editableProfile.enrolledSubjects;
      req.body.profile = editableProfile;
    }
    next();
  }, validate(updateUserSchema), userController.updateUser);
  router.patch('/:id/restore', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), userController.restoreUser);
  router.delete('/:id', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), userController.softDeleteUser);
  router.delete('/:id/permanent', authorize(ROLES.SUPERADMIN), userController.permanentDeleteUser);
  return router;
}

module.exports = { teachers: usersByRole(ROLES.TEACHER), students: usersByRole(ROLES.STUDENT, { allowCreate: false }) };
