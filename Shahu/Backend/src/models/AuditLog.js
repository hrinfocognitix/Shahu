const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: String,
  action: { type: String, required: true, index: true }, module: { type: String, required: true, index: true }, recordId: { type: mongoose.Schema.Types.ObjectId, index: true },
  previousValue: mongoose.Schema.Types.Mixed, newValue: mongoose.Schema.Types.Mixed, reason: String, ipAddress: String
}, { timestamps: { createdAt: true, updatedAt: false } });
auditLogSchema.index({ module: 1, recordId: 1, createdAt: -1 });
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function immutableAuditLog() { throw new Error('Audit logs are immutable'); });
module.exports = mongoose.model('AuditLog', auditLogSchema);
