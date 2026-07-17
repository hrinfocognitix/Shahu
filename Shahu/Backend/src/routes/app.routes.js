const express = require('express');
const { dashboard, catalog } = require('../controllers/app.controller');

const router = express.Router();

router.get('/dashboard', dashboard);
router.get('/catalog', catalog);

module.exports = router;
