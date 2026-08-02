const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const subjectSchema = new mongoose.Schema(
  {
    subjectId: { type: String, unique: true, trim: true },
    subjectCode: { type: String, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    semester: { type: String, default: '' },
    description: String,
    color: String,
    icon: String,
    notes: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

subjectSchema.plugin(auditPlugin);

const createSubjectCodePrefix = (name) =>
  String(name || 'SUB')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

async function createUniqueSubjectCode(name) {
  const Subject = mongoose.model('Subject');
  const prefix = createSubjectCodePrefix(name);

  for (let attempt = 0; attempt < 900; attempt += 1) {
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const subjectCode = `${prefix}${randomNumber}`;
    const exists = await Subject.exists({ subjectCode });

    if (!exists) {
      return subjectCode;
    }
  }

  throw new Error(`Unable to generate a unique subject code for ${prefix}`);
}

subjectSchema.pre('validate', async function setSubjectId() {
  if (this.name) {
    this.name = this.name.trim();
  }

  if (this.isNew) {
    this.subjectCode = await createUniqueSubjectCode(this.name);
    this.subjectId = this.subjectCode;
  } else if (this.subjectCode) {
    this.subjectCode = this.subjectCode.trim().toUpperCase();
    const duplicateCode = await mongoose.model('Subject').findOne({ _id: { $ne: this._id }, subjectCode: new RegExp(`^${this.subjectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (duplicateCode) throw new Error('Subject code already exists');
  }

  if (!this.subjectCode) {
    this.subjectCode = this.subjectId;
  } else if (!this.subjectId) {
    this.subjectId = this.subjectCode;
  }
});

module.exports = mongoose.model('Subject', subjectSchema);
