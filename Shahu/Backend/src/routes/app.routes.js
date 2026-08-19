const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const appInstallationController = require('../controllers/appInstallation.controller');
const { dashboard, catalog, androidUpdate } = require('../controllers/app.controller');

const router = express.Router();

router.post('/installations', appInstallationController.register);
router.patch('/installations/:uuid/student', authenticate, appInstallationController.linkStudent);

router.get('/dashboard', dashboard);
router.get('/catalog', catalog);
router.get('/android-update', androidUpdate);

module.exports = router;
