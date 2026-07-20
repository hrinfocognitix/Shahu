const Enrollment = require('../src/models/Enrollment');
const AcademyRecord = require('../src/models/AcademyRecord');
const { runExpiryReminders, utcDayRange } = require('../src/services/enrollmentReminder.service');

describe('enrollment reminder scheduling', () => {
  it('creates a stable UTC range for seven-day reminders', () => {
    const { start, end } = utcDayRange(7, new Date('2026-07-19T10:30:00.000Z'));
    expect(start.toISOString()).toBe('2026-07-26T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-27T00:00:00.000Z');
  });

  it('creates day-zero reminders before marking expired enrollments', async () => {
    const enrollment = {
      _id: 'enrollment-1',
      student: 'student-1',
      course: { _id: 'course-1', name: 'Foundation Course' },
      validUntil: new Date('2026-07-19T08:00:00.000Z'),
    };
    const populate = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([enrollment]);
    const find = jest.spyOn(Enrollment, 'find').mockReturnValue({ populate });
    const create = jest.spyOn(AcademyRecord, 'create').mockResolvedValue({});
    const update = jest.spyOn(Enrollment, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

    const result = await runExpiryReminders(new Date('2026-07-19T10:30:00.000Z'));

    expect(result).toEqual({ expired: 1, reminders: 1 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Course access expires today',
        student: 'student-1',
      })
    );
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
    find.mockRestore();
    create.mockRestore();
    update.mockRestore();
  });
});
