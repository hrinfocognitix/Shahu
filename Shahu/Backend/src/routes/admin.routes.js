const express = require('express');
const controller = require('../controllers/admin.controller');
const validate = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const { createAdminSchema, updateAdminSchema } = require('../validators/admin.validator');

const router = express.Router();
router.use(authenticate, authorize(ROLES.SUPERADMIN));
router.get('/', controller.list);
router.post('/', validate(createAdminSchema), controller.create);
router.patch('/:id', validate(updateAdminSchema), controller.update);

module.exports = router;
