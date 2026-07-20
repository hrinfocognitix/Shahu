const { authorize } = require('../src/middleware/role.middleware');
const { ROLES } = require('../src/constants/roles');

describe('role authorization', () => {
  it('allows an authorized admin role', () => {
    const next = jest.fn();
    authorize(ROLES.ADMIN, ROLES.SUPERADMIN)({ user: { role: ROLES.ADMIN } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a teacher from an admin-only operation', () => {
    const next = jest.fn();
    authorize(ROLES.ADMIN, ROLES.SUPERADMIN)({ user: { role: ROLES.TEACHER } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('restricts governance pages to super admin', () => {
    const adminNext = jest.fn();
    const superNext = jest.fn();
    authorize(ROLES.SUPERADMIN)({ user: { role: ROLES.ADMIN } }, {}, adminNext);
    authorize(ROLES.SUPERADMIN)({ user: { role: ROLES.SUPERADMIN } }, {}, superNext);
    expect(adminNext.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(superNext).toHaveBeenCalledWith();
  });
});
