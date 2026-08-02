const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));
router.get('/', paymentController.listAdmin);
router.post('/:paymentId/approve', paymentController.approve);
router.post('/:paymentId/reject', paymentController.reject);

module.exports = router;
