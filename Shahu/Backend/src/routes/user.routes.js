const express = require('express');
const userController = require('../controllers/user.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { updateUserSchema, updatePasswordSchema } = require('../validators/user.validator');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authenticate);
router.get('/me', userController.getProfile);
router.patch('/me/password', validate(updatePasswordSchema), userController.updateOwnPassword);
router.get('/', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.SUPERADMIN), userController.listUsers);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.SUPERADMIN), userController.getUser);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.SUPERADMIN), validate(updateUserSchema), userController.updateUser);

module.exports = router;
