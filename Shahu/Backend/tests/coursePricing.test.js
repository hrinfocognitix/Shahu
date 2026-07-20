const Course = require('../src/models/Course');
const { normalizeValidity, buildPricingSnapshot } = require('../src/controllers/courseCommerce.controller');

describe('course pricing', () => {
  it('calculates payable price from a percentage discount', async () => {
    const course = new Course({ courseId: 'PERCENT-TEST', courseCode: 'PERCENT-TEST', name: 'Percentage course', durationDays: 30, actualPrice: 10000, discountType: 'percentage', discountValue: 25 });
    await course.validate();
    expect(course.fees).toBe(7500);
    expect(course.discountPercent).toBe(25);
  });

  it('calculates payable price from a fixed discount', async () => {
    const course = new Course({ courseId: 'FIXED-TEST', courseCode: 'FIXED-TEST', name: 'Fixed course', durationDays: 30, actualPrice: 10000, discountType: 'fixed', discountValue: 1500 });
    await course.validate();
    expect(course.fees).toBe(8500);
    expect(course.discountPercent).toBe(15);
  });

  it('rejects an invalid percentage discount', async () => {
    const course = new Course({ courseId: 'INVALID-TEST', courseCode: 'INVALID-TEST', name: 'Invalid course', durationDays: 30, actualPrice: 10000, discountType: 'percentage', discountValue: 101 });
    await expect(course.validate()).rejects.toThrow();
  });

  it('rejects duplicate subject assignments', async () => {
    const subjectId = '507f1f77bcf86cd799439011';
    const course = new Course({ courseId: 'DUPLICATE-SUBJECT', courseCode: 'DUPLICATE-SUBJECT', name: 'Duplicate subject course', durationDays: 30, actualPrice: 1000, subjects: [subjectId, subjectId] });
    await expect(course.validate()).rejects.toThrow('Duplicate subjects are not allowed');
  });

  it('keeps ordered subject descriptions and sections aligned to selected subjects', async () => {
    const subjectId = '507f1f77bcf86cd799439012';
    const course = new Course({
      courseId: 'SUBJECT-SECTIONS',
      courseCode: 'SUBJECT-SECTIONS',
      name: 'Structured subject course',
      durationDays: 30,
      actualPrice: 1000,
      subjects: [subjectId],
      subjectDetails: [{
        subject: subjectId,
        description: '  Foundation concepts  ',
        displayOrder: 2,
        sections: [{ title: ' Introduction ', displayOrder: 0 }, { title: '  ' }],
      }],
    });
    await course.validate();
    expect(course.subjectDetails).toHaveLength(1);
    expect(course.subjectDetails[0].description).toBe('Foundation concepts');
    expect(course.subjectDetails[0].sections).toHaveLength(1);
    expect(course.subjectDetails[0].sections[0].title).toBe('Introduction');
  });

  it('rejects duplicate detail records for one course subject', async () => {
    const subjectId = '507f1f77bcf86cd799439013';
    const course = new Course({
      courseId: 'DUPLICATE-SUBJECT-DETAIL',
      courseCode: 'DUPLICATE-SUBJECT-DETAIL',
      name: 'Duplicate subject detail course',
      durationDays: 30,
      actualPrice: 1000,
      subjects: [subjectId],
      subjectDetails: [{ subject: subjectId }, { subject: subjectId }],
    });
    await expect(course.validate()).rejects.toThrow('Duplicate subject details are not allowed');
  });

  it('calculates course validity from the payment date in UTC', () => {
    const validity = normalizeValidity({ durationDays: 30 }, '2026-07-19T10:00:00.000Z');
    expect(validity.startDate.toISOString()).toBe('2026-07-19T10:00:00.000Z');
    expect(validity.endDate.toISOString()).toBe('2026-08-18T10:00:00.000Z');
  });

  it('builds the payment snapshot only from server-owned course pricing', () => {
    const pricing = buildPricingSnapshot({
      actualPrice: 1250,
      fees: 999,
      discountType: 'fixed',
      discountValue: 251,
      discountPercent: 20.08,
    });
    expect(pricing).toMatchObject({
      originalPrice: 1250,
      payablePrice: 999,
      paidAmount: 999,
      originalPriceMinor: 125000,
      payablePriceMinor: 99900,
      paidAmountMinor: 99900,
      discountAmountMinor: 25100,
    });
  });
});
