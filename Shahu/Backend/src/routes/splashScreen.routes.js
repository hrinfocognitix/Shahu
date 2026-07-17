const express = require('express');
const controller = require('../controllers/splashScreen.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();
router.get('/active', controller.active);
router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
module.exports = router;
