const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const validate = require('../middleware/validation.middleware');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');

function usersByRole(role) {
  const router = express.Router();
  router.use(authenticate);
  router.get('/', authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.SUPERADMIN), (req, res, next) => { req.query.role = role; return userController.listUsers(req, res, next); });
  router.post('/', authorize(ROLES.ADMIN), (req, res, next) => {
    req.body.role = role;
    return next();
  }, validate(createUserSchema), userController.createUser);
  router.patch('/:id', authorize(ROLES.ADMIN), validate(updateUserSchema), userController.updateUser);
  router.patch('/:id/restore', authorize(ROLES.ADMIN), userController.restoreUser);
  router.delete('/:id', authorize(ROLES.ADMIN), userController.softDeleteUser);
  router.delete('/:id/permanent', authorize(ROLES.SUPERADMIN), userController.permanentDeleteUser);
  return router;
}

module.exports = { teachers: usersByRole(ROLES.TEACHER), students: usersByRole(ROLES.STUDENT) };
