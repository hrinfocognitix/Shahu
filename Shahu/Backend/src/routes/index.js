const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const commonRoutes = require('./common.routes');
const academyRoutes = require('./academy.routes');
const staffRoutes = require('./staff.routes');
const dashboardRoutes = require('./dashboard.routes');
const splashScreenRoutes = require('./splashScreen.routes');
const deletedRecordsRoutes = require('./deletedRecords.routes');
const appRoutes = require('./app.routes');

const router = express.Router();

router.use('/', commonRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teachers', staffRoutes.teachers);
router.use('/students', staffRoutes.students);
router.use('/dashboard', dashboardRoutes);
router.use('/app', appRoutes);
router.use('/splash-screens', splashScreenRoutes);
router.use('/deleted-records', deletedRecordsRoutes);
academyRoutes.forEach(([path, route]) => router.use(path, route));

module.exports = router;
