const express = require('express');
const controller = require('../controllers/splashScreen.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const upload = require('../middleware/upload.middleware');

const router = express.Router();
router.get('/active', controller.active);
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));
router.get('/', controller.list);
router.post('/', upload.media.single('file'), controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
module.exports = router;
