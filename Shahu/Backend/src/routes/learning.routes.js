const express = require('express');
const controller = require('../controllers/learning.controller');
const upload = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');
const router = express.Router();
router.get('/files/:id/download', controller.downloadLearningFile);
router.use(authenticate);
router.get('/syllabus', controller.listSyllabus);
router.post(
  '/syllabus',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.createSyllabus
);
router.patch(
  '/syllabus/:id',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.updateSyllabus
);
router.delete(
  '/syllabus/:id',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.removeSyllabus
);
router.get('/files', controller.listLearningFiles);
router.post(
  '/files',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  upload.single('file'),
  controller.createLearningFile
);
router.patch(
  '/files/:id',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.updateLearningFile
);
router.delete(
  '/files/:id',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.removeLearningFile
);
router.get(
  '/questions/template',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.questionTemplate
);
router.post(
  '/questions/preview',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  upload.single('file'),
  controller.previewQuestions
);
router.post(
  '/questions/import/:id',
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.TEACHER),
  controller.confirmQuestions
);
router.get('/questions', controller.listQuestions);
router.post('/questions/submit', authorize(ROLES.STUDENT), controller.submitAnswers);
module.exports = router;
