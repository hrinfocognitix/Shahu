const Enrollment = require('../models/Enrollment');
const AcademyRecord = require('../models/AcademyRecord');
const logger = require('../config/logger');
const { sendNotificationPush } = require('./notification.service');

function utcDayRange(daysAhead, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function runExpiryReminders(now = new Date()) {
  let reminders = 0;
  // The app shows a warning throughout the last 10 days; pushes are sent at
  // these useful milestones and the dedupe key prevents repeat messages.
  for (const days of [10, 3, 1, 0]) {
    const { start, end } = utcDayRange(days, now);
    const enrollments = await Enrollment.find({
      status: 'active',
      validUntil: { $gte: start, $lt: end },
    }).populate('course', 'name');
    for (const enrollment of enrollments) {
      const dedupeKey = `expiry:${enrollment._id}:${days}:${start.toISOString().slice(0, 10)}`;
      try {
        await AcademyRecord.create({
          module: 'notification',
          title:
            days === 0
              ? 'Course access expires today'
              : `Course access expires in ${days} day${days === 1 ? '' : 's'}`,
          description: `${enrollment.course?.name || 'Your course'} is valid until ${enrollment.validUntil.toLocaleDateString('en-IN')}.`,
          course: enrollment.course?._id || enrollment.course,
          student: enrollment.student,
          audience: 'students',
          status: 'active',
          payload: {
            type: 'course_expiry_reminder',
            enrollmentId: enrollment._id,
            daysRemaining: days,
            validUntil: enrollment.validUntil,
            dedupeKey,
          },
        });
        await sendNotificationPush({
          title:
            days === 0
              ? 'Course access expires today'
              : `Course access expires in ${days} day${days === 1 ? '' : 's'}`,
          body: `${enrollment.course?.name || 'Your course'} is valid until ${enrollment.validUntil.toLocaleDateString('en-IN')}.`,
          student: enrollment.student,
          data: {
            type: 'course_expiry_reminder',
            enrollmentId: enrollment._id,
            courseId: enrollment.course?._id || enrollment.course,
            daysRemaining: days,
            deepLink: `shahu://course/${enrollment.course?._id || enrollment.course}`,
          },
        });
        reminders += 1;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
  }
  // Create today's reminder before changing the enrollment status. Otherwise an
  // enrollment that expired earlier today would be excluded from the day-zero query.
  const expired = await Enrollment.updateMany(
    { status: 'active', validUntil: { $lt: now } },
    { $set: { status: 'expired', updatedAt: now } }
  );
  return { expired: expired.modifiedCount || 0, reminders };
}

async function runAndLog() {
  try {
    const summary = await runExpiryReminders();
    logger.info(
      `Enrollment maintenance: ${summary.expired} expired, ${summary.reminders} reminders created`
    );
  } catch (error) {
    logger.error('Enrollment reminder job failed', error);
  }
}

module.exports = { runExpiryReminders, runAndLog, utcDayRange };
