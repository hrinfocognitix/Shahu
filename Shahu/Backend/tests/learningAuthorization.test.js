const Course = require('../src/models/Course');
const { ROLES } = require('../src/constants/roles');
const { _internals } = require('../src/controllers/learning.controller');

describe('learning content authorization', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows a teacher to manage an assigned subject', async () => {
    const subject = '507f1f77bcf86cd799439021';
    await expect(
      _internals.assertSubjectAccess(
        { user: { role: ROLES.TEACHER, profile: { assignedSubjects: [subject] } } },
        subject
      )
    ).resolves.toBeUndefined();
  });

  it('rejects a teacher attempting to manage an unassigned subject', async () => {
    await expect(
      _internals.assertSubjectAccess(
        {
          user: {
            role: ROLES.TEACHER,
            profile: { assignedSubjects: ['507f1f77bcf86cd799439021'] },
          },
        },
        '507f1f77bcf86cd799439022'
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('requires the subject to belong to the selected course', async () => {
    jest.spyOn(Course, 'exists').mockResolvedValue(null);
    await expect(
      _internals.assertCourseSubject(
        '507f1f77bcf86cd799439023',
        '507f1f77bcf86cd799439024'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
