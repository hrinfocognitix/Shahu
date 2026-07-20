const { createAdminSchema, updateAdminSchema } = require('../src/validators/admin.validator');

describe('admin management validation', () => {
  it('accepts a normalized admin identity', () => {
    const { error, value } = createAdminSchema.validate({ name: 'Portal Admin', email: ' ADMIN@EXAMPLE.COM ' });
    expect(error).toBeUndefined();
    expect(value.email).toBe('admin@example.com');
  });

  it('does not allow role, email, or password mutation through admin update', () => {
    expect(updateAdminSchema.validate({ role: 'superadmin' }).error).toBeDefined();
    expect(updateAdminSchema.validate({ email: 'other@example.com' }).error).toBeDefined();
    expect(updateAdminSchema.validate({ password: 'UnsafePassword' }).error).toBeDefined();
  });
});
