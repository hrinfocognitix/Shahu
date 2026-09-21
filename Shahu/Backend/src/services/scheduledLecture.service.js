const Content = require('../models/Content');
const Enrollment = require('../models/Enrollment');
const { sendNotificationPush } = require('./notification.service');
const logger = require('../config/logger');

async function notifyLecture(lecture, now, title, body) {
  const studentIds = await Enrollment.find({
    course: lecture.course._id,
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  }).distinct('student');
  const courseName = lecture.course.name || 'Your course';
  const subjectName = lecture.subject?.name || 'Course lecture';
  await sendNotificationPush({
    title,
    body: body(courseName, subjectName),
    students: studentIds,
    data: {
      type: 'scheduled_lecture',
      videoId: lecture._id,
      courseId: lecture.course._id,
      courseName,
      subjectId: lecture.subject?._id || '',
      subjectName,
      scheduledAt: lecture.scheduledAt?.toISOString() || '',
      deepLink: `shahu://course/${lecture.course._id}?videoId=${lecture._id}`,
    },
  });
  return studentIds.length;
}

/** Deliver each live-class reminder once, at (or immediately after) its IST start time. */
async function sendDueLectureNotifications() {
  const now = new Date();
  const dueLectures = await Content.find({
    type: 'video',
    scheduledAt: { $lte: now },
    liveNotificationSentAt: null,
  }).select('_id').lean();

  for (const item of dueLectures) {
    // Atomically claim the lecture. This is safe if more than one server/cron
    // instance happens to run at the same time.
    const lecture = await Content.findOneAndUpdate(
      { _id: item._id, liveNotificationSentAt: null },
      { $set: { liveNotificationSentAt: now } },
      { new: true },
    ).populate('course', 'name').populate('subject', 'name').lean();
    if (!lecture?.course?._id) continue;

    const students = await notifyLecture(
      lecture,
      now,
      'Live lecture is starting now',
      (courseName, subjectName) => `${courseName} · ${subjectName} · ${lecture.title}`,
    );
    logger.info('Scheduled live lecture notification sent', { lectureId: String(lecture._id), students });
  }
}

/** Send a single reminder during the five minutes before the scheduled start. */
async function sendLectureFiveMinuteReminders() {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  const reminders = await Content.find({
    type: 'video',
    scheduledAt: { $gt: now, $lte: fiveMinutesFromNow },
    liveReminderSentAt: null,
  }).select('_id').lean();
  for (const item of reminders) {
    const lecture = await Content.findOneAndUpdate(
      { _id: item._id, liveReminderSentAt: null },
      { $set: { liveReminderSentAt: now } },
      { new: true },
    ).populate('course', 'name').populate('subject', 'name').lean();
    if (!lecture?.course?._id) continue;
    const students = await notifyLecture(
      lecture,
      now,
      'Your live lecture starts within 5 minutes',
      (courseName, subjectName) => `${courseName} · ${subjectName} · ${lecture.title}`,
    );
    logger.info('Five-minute live lecture reminder sent', { lectureId: String(lecture._id), students });
  }
}

module.exports = { sendDueLectureNotifications, sendLectureFiveMinuteReminders };
