const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const deletedRecordsController = require('../controllers/deletedRecords.controller');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get('/', authenticate, authorize(ROLES.SUPERADMIN), deletedRecordsController.listDeletedRecords);
router.delete('/', authenticate, authorize(ROLES.SUPERADMIN), deletedRecordsController.permanentlyDeleteRecords);

module.exports = router;
