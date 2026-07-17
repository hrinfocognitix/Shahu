const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const subjectSchema = new mongoose.Schema(
  {
    subjectId: { type: String, unique: true, trim: true },
    subjectCode: { type: String, unique: true, trim: true },
    name: { type: String, required: true, trim: true, unique: true },
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
subjectSchema.pre('validate', async function setSubjectId() {
  if (this.name) {
    this.name = this.name.trim();
  }

  if (this.name) {
    const normalizedName = this.name.toLowerCase();
    const duplicate = await mongoose.model('Subject').findOne({
      _id: { $ne: this._id },
      name: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });

    if (duplicate) {
      throw new Error('Subject name already exists');
    }
  }

  if (!this.subjectId && !this.subjectCode) {
    const prefix = (this.name || 'SUB')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, 'X');
    const randomNumber = String(Math.floor(1000 + Math.random() * 9000));
    this.subjectCode = `${prefix}${randomNumber}`;
    this.subjectId = this.subjectCode;
  } else if (!this.subjectCode) {
    this.subjectCode = this.subjectId;
  } else if (!this.subjectId) {
    this.subjectId = this.subjectCode;
  }
});

module.exports = mongoose.model('Subject', subjectSchema);
