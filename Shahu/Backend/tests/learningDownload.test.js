const { ROLES } = require('../src/constants/roles');
const { _internals } = require('../src/controllers/learning.controller');

describe('learning download signatures', () => {
  const now = new Date('2026-07-19T10:30:00.000Z').getTime();

  it('encodes the file, user, role and ten-minute expiry', () => {
    const token = _internals.signDownload('file-1', 'student-1', ROLES.STUDENT, now);
    expect(_internals.verifyDownload(token, now + 9 * 60 * 1000)).toMatchObject({
      fileId: 'file-1',
      userId: 'student-1',
      role: ROLES.STUDENT,
      expiresAt: now + 10 * 60 * 1000,
    });
  });

  it('rejects expired and tampered links', () => {
    const token = _internals.signDownload('file-1', 'student-1', ROLES.STUDENT, now);
    expect(_internals.verifyDownload(token, now + 10 * 60 * 1000 + 1)).toBeNull();
    expect(_internals.verifyDownload(`${token.slice(0, -1)}x`, now)).toBeNull();
  });
});
