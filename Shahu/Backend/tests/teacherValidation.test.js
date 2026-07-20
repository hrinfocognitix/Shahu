jest.mock('../src/repositories/user.repository', () => ({
  findByEmail: jest.fn(),
  findTeacherByMobile: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../src/helpers/bcrypt.helper', () => ({ hashPassword: jest.fn(async value => `hashed:${value}`), comparePassword: jest.fn() }));

const repository = require('../src/repositories/user.repository');
const { createUser } = require('../src/services/user.service');
const { ROLES } = require('../src/constants/roles');

describe('teacher uniqueness validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a duplicate normalized email', async () => {
    repository.findByEmail.mockResolvedValue({ _id: 'existing' });
    await expect(createUser({ name: 'Teacher', email: ' Teacher@Example.com ', role: ROLES.TEACHER, profile: { mobile: '9876543210' } })).rejects.toThrow('A teacher with this email address already exists.');
    expect(repository.findByEmail).toHaveBeenCalledWith('teacher@example.com');
  });

  it('rejects a duplicate normalized mobile number', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.findTeacherByMobile.mockResolvedValue({ _id: 'existing' });
    await expect(createUser({ name: 'Teacher', email: 'teacher@example.com', role: ROLES.TEACHER, profile: { mobile: '+91 98765 43210' } })).rejects.toThrow('A teacher with this mobile number already exists.');
    expect(repository.findTeacherByMobile).toHaveBeenCalledWith('9876543210');
  });

  it('returns a one-time teacher password without persisting its plaintext value', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.findTeacherByMobile.mockResolvedValue(null);
    repository.create.mockResolvedValue({ _id: 'teacher-id', email: 'teacher@example.com' });
    const result = await createUser({
      name: 'Teacher', email: 'teacher@example.com', role: ROLES.TEACHER,
      profile: { mobile: '9876543210' },
    });
    expect(result.temporaryPassword).toMatch(/^Tch-/);
    expect(result.user).toMatchObject({ _id: 'teacher-id' });
    expect(repository.create.mock.calls[0][0].password).toBe(`hashed:${result.temporaryPassword}`);
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty('initialPassword');
  });
});
