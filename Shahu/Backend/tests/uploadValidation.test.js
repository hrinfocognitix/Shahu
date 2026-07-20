const upload = require('../src/middleware/upload.middleware');

const accepted = upload._internals.accepted;

describe('upload type and extension validation', () => {
  it('accepts matching public image and video types', () => {
    expect(accepted({ originalname: 'banner.jpg', mimetype: 'image/jpeg' }, true)).toBe(true);
    expect(accepted({ originalname: 'intro.mp4', mimetype: 'video/mp4' }, true)).toBe(true);
  });

  it('rejects documents from the public media endpoint', () => {
    expect(accepted({ originalname: 'notes.pdf', mimetype: 'application/pdf' }, true)).toBe(false);
  });

  it('rejects mismatched extensions even when the claimed MIME type is allowed', () => {
    expect(accepted({ originalname: 'payload.pdf', mimetype: 'image/jpeg' }, true)).toBe(false);
    expect(accepted({ originalname: 'payload.exe', mimetype: 'application/pdf' }, false)).toBe(false);
  });

  it('accepts protected documents only with matching formats', () => {
    expect(accepted({ originalname: 'notes.pdf', mimetype: 'application/pdf' }, false)).toBe(true);
    expect(accepted({ originalname: 'questions.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, false)).toBe(true);
  });
});
