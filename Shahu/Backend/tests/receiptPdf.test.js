const { createReceiptPdf } = require('../src/services/receiptPdf.service');

describe('purchase receipt PDF', () => {
  it('creates a valid PDF containing tracking, payment and validity details', () => {
    const pdf = createReceiptPdf({
      receiptNumber: 'RCP-PUR-TEST-1',
      purchaseId: 'PUR-TEST-1',
      student: { name: 'Student One', email: 'student@example.com', profile: {} },
      course: { name: 'Foundation Course', courseCode: 'FC-01' },
      transaction: {
        transactionReference: 'UTR123',
        paymentMethod: 'upi',
        paymentDate: new Date('2026-07-19T00:00:00.000Z'),
        status: 'successful',
        buyer: { mobileNo: '9999999999' },
        pricing: { paidAmountMinor: 125000 },
      },
      enrollment: {
        validityDays: 30,
        validFrom: new Date('2026-07-19T00:00:00.000Z'),
        validUntil: new Date('2026-08-18T00:00:00.000Z'),
      },
    });
    const value = pdf.toString('latin1');
    expect(value.startsWith('%PDF-1.4')).toBe(true);
    expect(value).toContain('PUR-TEST-1');
    expect(value).toContain('INR 1250.00');
    expect(value.endsWith('%%EOF')).toBe(true);
  });
});
