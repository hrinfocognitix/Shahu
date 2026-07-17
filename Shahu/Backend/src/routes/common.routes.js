const express = require('express');
const commonController = require('../controllers/common.controller');
const upload = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/health', commonController.health);
router.post('/upload', authenticate, upload.single('file'), commonController.uploadFile);

module.exports = router;
