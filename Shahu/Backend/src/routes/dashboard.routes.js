const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();
router.get('/stats', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.SUPERADMIN), dashboardController.statistics);

module.exports = router;
