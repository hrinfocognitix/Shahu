function escapePdfText(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

function createReceiptPdf({ receiptNumber, purchaseId, student, course, transaction, enrollment }) {
  const paidMinor = transaction.pricing?.paidAmountMinor;
  const paid =
    paidMinor != null ? Number(paidMinor) / 100 : Number(transaction.pricing?.paidAmount || 0);
  const lines = [
    'GS BY ANAND SIR',
    'COURSE PURCHASE RECEIPT',
    '',
    `Receipt: ${receiptNumber}`,
    `Purchase tracking ID: ${purchaseId}`,
    `Transaction reference: ${transaction.transactionReference}`,
    `Payment method: ${transaction.paymentMethod}`,
    `Payment date: ${new Date(transaction.paymentDate).toLocaleDateString('en-IN')}`,
    `Payment status: ${transaction.status}`,
    '',
    `Student: ${student.name}`,
    `Registered email: ${student.email}`,
    `Mobile: ${student.profile?.mobile || student.profile?.phone || transaction.buyer.mobileNo}`,
    '',
    `Course: ${course.name}`,
    `Course code: ${course.courseCode || course.courseId || '-'}`,
    `Amount paid: INR ${paid.toFixed(2)}`,
    `Validity: ${enrollment.validityDays} days`,
    `Valid from: ${new Date(enrollment.validFrom).toLocaleDateString('en-IN')}`,
    `Valid until: ${new Date(enrollment.validUntil).toLocaleDateString('en-IN')}`,
    '',
    'This is an official GS BY Anand Sir course-purchase receipt.',
  ];
  const body = lines
    .map(
      (line, index) =>
        `BT /F1 ${index < 2 ? 16 : 10} Tf 50 ${675 - index * 25} Td (${escapePdfText(line)}) Tj ET`
    )
    .join('\n');
  // A compact vector wordmark keeps the receipt branded without relying on a
  // remote image URL or a fragile filesystem asset in production.
  const text = `q\n0.09 0.25 0.23 rg\n0 744 595 98 re f\n0.66 0.49 0.26 rg\n28 762 52 52 re f\nQ\nBT /F1 23 Tf 1 1 1 rg 96 790 Td (GS BY Anand Sir) Tj ET\nBT /F1 10 Tf 0.91 0.94 0.92 rg 96 771 Td (Official course purchase receipt) Tj ET\nBT /F1 18 Tf 1 1 1 rg 39 780 Td (GS) Tj ET\n${body}`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

module.exports = { createReceiptPdf };
