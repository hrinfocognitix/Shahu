const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

function createResourceRouter(
  controller,
  { publicRead = false, writeRoles = [ROLES.ADMIN, ROLES.SUPERADMIN], permanentRemoveRoles = [ROLES.SUPERADMIN] } = {}
) {
  const router = express.Router();
  if (publicRead) router.get('/', controller.list);
  router.use(authenticate);
  if (!publicRead) router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', authorize(...writeRoles), controller.create);
  router.patch('/:id', authorize(...writeRoles), controller.update);
  router.patch('/:id/restore', authorize(...writeRoles), controller.restore);
  router.delete('/:id', authorize(...writeRoles), controller.remove);
  router.delete('/:id/permanent', authorize(...permanentRemoveRoles), controller.permanentRemove);
  return router;
}
module.exports = createResourceRouter;
