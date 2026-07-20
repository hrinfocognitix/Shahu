const express = require('express');
const controller = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();
router.use(authenticate, authorize(ROLES.SUPERADMIN));
router.get('/', controller.list);

module.exports = router;
