const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

function sanitizeList(values = []) {
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function sanitizeDetailSections(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .map(section => ({
      title: String(section?.title || '').trim(),
      description: String(section?.description || '').trim(),
      items: (Array.isArray(section?.items) ? section.items : [])
        .map(item => ({
          label: String(item?.label || '').trim(),
          type: String(item?.type || 'text').trim(),
          value: String(item?.value || '').trim()
        }))
        .filter(item => item.label || item.value)
    }))
    .filter(section => section.title || section.description || section.items.length);
}

function buildCourseCode(name, stamp = new Date()) {
  const dd = String(stamp.getDate()).padStart(2, '0');
  const mm = String(stamp.getMonth() + 1).padStart(2, '0');
  const yy = String(stamp.getFullYear()).slice(-2);
  const hh = String(stamp.getHours()).padStart(2, '0');
  const min = String(stamp.getMinutes()).padStart(2, '0');
  const ss = String(stamp.getSeconds()).padStart(2, '0');
  const prefix = String(name || 'COURSE')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 18) || 'COURSE';

  return `${prefix}${dd}${mm}${yy}-${hh}${min}${ss}`;
}

const courseSchema = new mongoose.Schema(
  {
    courseId: { type: String, unique: true, trim: true },
    courseCode: { type: String, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    duration: { type: String, default: '' },
    durationDays: { type: Number, min: 1, default: 0 },
    durationMonths: { type: Number, min: 0, default: 0 },
    validity: String,
    fees: { type: Number, min: 0, default: 0 },
    actualPrice: { type: Number, min: 0, default: 0 },
    // Keeps the exact admin-entered currency presentation (for example, "10.00").
    // Numeric fields and minor units remain the source for calculations and payments.
    actualPriceDisplay: { type: String, trim: true, default: '0.00' },
    actualPriceMinor: { type: Number, min: 0, default: 0 },
    payablePriceMinor: { type: Number, min: 0, default: 0 },
    discountAmountMinor: { type: Number, min: 0, default: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, min: 0, default: 0 },
    offerText: { type: String, trim: true, maxlength: 120, default: '' },
    primaryPaymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademyRecord' },
    acceptedPaymentAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AcademyRecord' }],
    price: { type: Number, min: 0, default: 0 },
    discountPrice: { type: Number, min: 0, default: 0 },
    gst: { type: Number, min: 0, default: 0 },
    image: String,
    imageUrl: String,
    bannerImage: String,
    thumbnail: String,
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', ''], default: '' },
    language: String,
    category: String,
    courseType: { type: String, enum: ['UI', 'Professional'], default: 'Professional' },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    subjectDetails: [
      {
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        description: { type: String, trim: true, default: '' },
        displayOrder: { type: Number, min: 0, default: 0 },
        sections: [
          {
            title: { type: String, required: true, trim: true },
            description: { type: String, trim: true, default: '' },
            displayOrder: { type: Number, min: 0, default: 0 },
          },
        ],
      },
    ],
    eligibility: String,
    learnings: [String],
    skillsCovered: [String],
    curriculum: [{ title: String, description: String, duration: String }],
    detailSections: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        items: [
          {
            label: { type: String, trim: true },
            type: {
              type: String,
              enum: ['text', 'notes', 'question-paper', 'question-list', 'link', 'video', 'document', 'other'],
              default: 'text'
            },
            value: { type: String, trim: true }
          }
        ]
      }
    ],
    careerOpportunities: [String],
    benefits: [String],
    useCases: [String],
    highlights: [String],
    priceHistory: [
      {
        previousActualPrice: { type: Number, min: 0, required: true },
        updatedActualPrice: { type: Number, min: 0, required: true },
        previousPayablePrice: { type: Number, min: 0, required: true },
        updatedPayablePrice: { type: Number, min: 0, required: true },
        previousDiscountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
        updatedDiscountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
        previousDiscountValue: { type: Number, min: 0, default: 0 },
        updatedDiscountValue: { type: Number, min: 0, default: 0 },
        reason: { type: String, trim: true, default: '' },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    lastUpdatedReason: { type: String, trim: true, default: '' },
    lastDeletedReason: { type: String, trim: true, default: '' },
    actionHistory: [
      {
        action: { type: String, enum: ['created', 'updated', 'deleted', 'restored'], required: true },
        reason: { type: String, trim: true, default: '' },
        actedAt: { type: Date, default: Date.now },
        actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    requirements: [String],
    certificateAvailable: { type: Boolean, default: false },
    demoVideoUrl: String,
    faqs: [{ question: String, answer: String }],
    tags: [String],
    seoKeywords: [String],
    featured: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    visibility: { type: String, enum: ['public', 'private', 'hidden'], default: 'public' },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payment: {
      qrCode: String,
      bankName: String,
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      upiId: String,
      googlePay: String,
      phonePe: String,
      paytm: String,
      whatsapp: String,
      supportEmail: String
    },
    brochurePdf: String,
    notes: [String],
    assignments: [String],
    testSeries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
    liveClassEnabled: { type: Boolean, default: false },
    recordedVideosEnabled: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviews: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, rating: Number, comment: String }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

courseSchema.plugin(auditPlugin);

courseSchema.pre('validate', async function setCourseFields() {
  if (this.name) {
    this.name = this.name.trim();
  }

  this.benefits = sanitizeList(this.benefits);
  this.useCases = sanitizeList(this.useCases);
  this.highlights = sanitizeList(this.highlights);
  this.learnings = sanitizeList(this.learnings);
  this.skillsCovered = sanitizeList(this.skillsCovered);
  this.detailSections = sanitizeDetailSections(this.detailSections);

  const subjectIds = (this.subjects || []).map(subject => String(subject?._id || subject));
  if (new Set(subjectIds).size !== subjectIds.length) throw new Error('Duplicate subjects are not allowed in a course');
  const selected = new Set(subjectIds);
  const detailBySubject = new Map();
  for (const detail of this.subjectDetails || []) {
    const subjectId = String(detail?.subject?._id || detail?.subject || '');
    if (!subjectId || !selected.has(subjectId)) continue;
    if (detailBySubject.has(subjectId)) throw new Error('Duplicate subject details are not allowed in a course');
    detailBySubject.set(subjectId, {
      subject: detail.subject?._id || detail.subject,
      description: String(detail.description || '').trim(),
      displayOrder: Math.max(0, Number(detail.displayOrder || 0)),
      sections: (detail.sections || [])
        .map((section, index) => ({
          title: String(section?.title || '').trim(),
          description: String(section?.description || '').trim(),
          displayOrder: Math.max(0, Number(section?.displayOrder ?? index)),
        }))
        .filter(section => section.title),
    });
  }
  this.subjectDetails = subjectIds.map((subjectId, index) =>
    detailBySubject.get(subjectId) || {
      subject: this.subjects[index]?._id || this.subjects[index],
      description: '',
      displayOrder: index,
      sections: [],
    }
  );

  if (this.durationDays) {
    const monthEstimate = Number((this.durationDays / 30).toFixed(1));
    this.durationMonths = monthEstimate;
    this.duration = `${this.durationDays} days (~${monthEstimate} months)`;
  }

  if (this.actualPrice > 0) {
    const discountValue = Number(this.discountValue || this.discountPercent || 0);
    if (this.discountType === 'percentage') {
      if (discountValue > 100) throw new Error('Percentage discount cannot exceed 100%');
      this.discountValue = discountValue;
      this.discountPercent = discountValue;
      this.fees = Math.max(0, Number((this.actualPrice - (this.actualPrice * discountValue / 100)).toFixed(2)));
    } else {
      if (discountValue > this.actualPrice) throw new Error('Fixed discount cannot exceed the actual price');
      this.discountValue = discountValue;
      this.fees = Math.max(0, Number((this.actualPrice - discountValue).toFixed(2)));
      this.discountPercent = this.actualPrice ? Number(((discountValue / this.actualPrice) * 100).toFixed(2)) : 0;
    }
  }
  this.actualPriceMinor = Math.round(Number(this.actualPrice || 0) * 100);
  this.payablePriceMinor = Math.round(Number(this.fees || 0) * 100);
  this.discountAmountMinor = Math.max(0, this.actualPriceMinor - this.payablePriceMinor);

  if (!this.imageUrl) {
    this.imageUrl = '/uploads/course-default-poster.png';
  }

  if (!this.courseId && !this.courseCode) {
    let generated = buildCourseCode(this.name);
    let suffix = 1;
    while (await mongoose.model('Course').exists({ _id: { $ne: this._id }, courseCode: generated })) {
      generated = `${buildCourseCode(this.name)}-${suffix}`;
      suffix += 1;
    }
    this.courseCode = generated;
    this.courseId = generated;
  } else if (!this.courseCode) {
    this.courseCode = this.courseId;
  } else if (!this.courseId) {
    this.courseId = this.courseCode;
  }
});

module.exports = mongoose.model('Course', courseSchema);
