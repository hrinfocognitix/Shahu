const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const controller = require('../controllers/systemData.controller');

const router = express.Router();
router.use(authenticate, authorize(ROLES.SUPERADMIN));
router.get('/summary', controller.dataSummary);
router.delete('/courses/:id', controller.deleteCourse);
router.delete('/students/:id', controller.deleteStudent);
router.delete('/all', controller.clearAcademyData);

module.exports = router;
