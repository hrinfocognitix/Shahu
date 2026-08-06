const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const controller = require('../controllers/results.controller');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER));
router.get('/summary', controller.studentSummaries);
router.get('/student/:studentId', controller.studentResultDetails);
module.exports = router;
