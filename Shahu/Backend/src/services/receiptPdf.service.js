function escapePdfText(value) {
  return String(value ?? '-')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pdfText(value, x, y, size = 10, font = 'F1', color = '0.16 0.15 0.13') {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(value)}) Tj ET`;
}

function createReceiptPdf({ receiptNumber, purchaseId, student, course, transaction, enrollment }) {
  const paidMinor = transaction.pricing?.paidAmountMinor;
  const paid = paidMinor != null ? Number(paidMinor) / 100 : Number(transaction.pricing?.paidAmount || 0);
  const paymentReference = transaction.gatewayReference || transaction.transactionReference || purchaseId;
  const mobile = student.profile?.mobile || student.profile?.phone || transaction.buyer?.mobileNo;
  const rows = [
    ['Receipt number', receiptNumber],
    ['Purchase tracking ID', purchaseId],
    ['Transaction reference', transaction.transactionReference],
    ['Gateway / UTR reference', paymentReference],
    ['Payment method', transaction.paymentMethod],
    ['Payment status', transaction.status],
    ['Payment date', formatDate(transaction.paymentDate || transaction.verifiedAt)],
    ['Amount paid', `INR ${paid.toFixed(2)}`],
  ];
  const courseRows = [
    ['Course name', course.name],
    ['Course code', course.courseCode || course.courseId || '-'],
    ['Course duration', `${enrollment.validityDays || course.durationDays || '-'} days`],
    ['Validity start date', formatDate(enrollment.validFrom)],
    ['Validity end date', formatDate(enrollment.validUntil)],
    ['Enrollment status', enrollment.status || 'active'],
  ];

  const content = [
    'q 0.09 0.25 0.23 rg 0 744 595 98 re f Q',
    'q 0.66 0.49 0.26 rg 28 762 52 52 re f Q',
    pdfText('GS', 39, 780, 18, 'F2', '1 1 1'),
    pdfText('GS BY ANAND SIR', 96, 790, 23, 'F2', '1 1 1'),
    pdfText('OFFICIAL COURSE PURCHASE RECEIPT', 96, 770, 10, 'F1', '0.91 0.94 0.92'),
    pdfText('Payment successfully received', 50, 718, 13, 'F2', '0.09 0.25 0.23'),
    pdfText(`Student: ${student.name || '-'}`, 50, 696),
    pdfText(`Email: ${student.email || transaction.buyer?.email || '-'}`, 50, 680),
    pdfText(`Mobile: ${mobile || '-'}`, 50, 664),
    'q 0.95 0.93 0.89 rg 40 438 515 202 re f Q',
    pdfText('PAYMENT TRANSACTION DETAILS', 52, 620, 11, 'F2', '0.09 0.25 0.23'),
    ...rows.flatMap(([label, value], index) => [
      pdfText(label, 52, 596 - index * 21, 9, 'F1', '0.40 0.36 0.31'),
      pdfText(value, 255, 596 - index * 21, 9, 'F2'),
    ]),
    'q 0.95 0.93 0.89 rg 40 234 515 174 re f Q',
    pdfText('COURSE AND ACCESS VALIDITY', 52, 388, 11, 'F2', '0.09 0.25 0.23'),
    ...courseRows.flatMap(([label, value], index) => [
      pdfText(label, 52, 364 - index * 21, 9, 'F1', '0.40 0.36 0.31'),
      pdfText(value, 255, 364 - index * 21, 9, 'F2'),
    ]),
    '0.75 0.70 0.62 RG 40 210 m 555 210 l S',
    pdfText('Keep this receipt for your records. Course access is active for the validity period above.', 50, 188, 9, 'F1', '0.40 0.36 0.31'),
    pdfText('GS BY Anand Sir - Academy support and learning portal', 50, 48, 8, 'F1', '0.40 0.36 0.31'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

module.exports = { createReceiptPdf };
