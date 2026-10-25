const mongoose = require('mongoose');
const auditPlugin = require('./plugins/audit.plugin');

const courseTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

courseTypeSchema.plugin(auditPlugin);

courseTypeSchema.pre('validate', function normalize() {
  this.name = String(this.name || '').trim();
  this.code = String(this.code || '').trim().toUpperCase();
});

module.exports = mongoose.model('CourseType', courseTypeSchema);
