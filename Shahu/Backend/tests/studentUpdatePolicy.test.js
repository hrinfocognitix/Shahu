const { updateUserSchema } = require('../src/validators/user.validator');
const { _internals } = require('../src/services/user.service');

describe('student and teacher profile update policy', () => {
  it('allows approved profile and account-status fields', () => {
    const { error } = updateUserSchema.validate({
      name: 'Updated Student',
      isActive: true,
      profile: { address: 'Kolhapur', city: 'Kolhapur', currentClass: '12th' },
    });
    expect(error).toBeUndefined();
  });

  it('rejects email and role changes through the generic user update API', () => {
    expect(updateUserSchema.validate({ email: 'changed@example.com' }).error).toBeDefined();
    expect(updateUserSchema.validate({ role: 'admin' }).error).toBeDefined();
  });

  it('rejects commerce and enrollment fields inside profile updates', () => {
    expect(
      updateUserSchema.validate({
        profile: {
          purchasedCourses: ['507f1f77bcf86cd799439031'],
          paymentStatus: 'successful',
        },
      }).error
    ).toBeDefined();
  });

  it('preserves historical commerce fields when an approved profile field changes', () => {
    const purchasedCourses = ['507f1f77bcf86cd799439031'];
    const merged = _internals.mergeProfile(
      { address: 'Old address', purchasedCourses, paymentStatus: 'successful' },
      { address: 'New address' }
    );
    expect(merged).toEqual({
      address: 'New address',
      purchasedCourses,
      paymentStatus: 'successful',
    });
  });
});
