function auditPlugin(schema) {
  schema.add({
    createdBy: { type: schema.constructor.Types.ObjectId, ref: 'User' },
    updatedBy: { type: schema.constructor.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: schema.constructor.Types.ObjectId, ref: 'User' },
    restoredAt: Date,
    restoredBy: { type: schema.constructor.Types.ObjectId, ref: 'User' }
  });
}

module.exports = auditPlugin;
