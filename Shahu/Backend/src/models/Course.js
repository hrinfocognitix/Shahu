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
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
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

  if (this.durationDays) {
    const monthEstimate = Number((this.durationDays / 30).toFixed(1));
    this.durationMonths = monthEstimate;
    this.duration = `${this.durationDays} days (~${monthEstimate} months)`;
  }

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
