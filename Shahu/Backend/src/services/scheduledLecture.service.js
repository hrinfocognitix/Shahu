const Content = require('../models/Content');
const Enrollment = require('../models/Enrollment');
const { sendNotificationPush } = require('./notification.service');
const logger = require('../config/logger');

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

    const studentIds = await Enrollment.find({
      course: lecture.course._id,
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).distinct('student');
    const courseName = lecture.course.name || 'Your course';
    const subjectName = lecture.subject?.name || 'Course lecture';
    await sendNotificationPush({
      title: 'Live lecture is starting now',
      body: `${courseName} · ${subjectName} · ${lecture.title}`,
      students: studentIds,
      data: {
        type: 'scheduled_lecture',
        videoId: lecture._id,
        courseId: lecture.course._id,
        courseName,
        subjectId: lecture.subject?._id || '',
        subjectName,
        scheduledAt: lecture.scheduledAt?.toISOString() || '',
      },
    });
    logger.info('Scheduled live lecture notification sent', { lectureId: String(lecture._id), students: studentIds.length });
  }
}

module.exports = { sendDueLectureNotifications };
