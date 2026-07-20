const mongoose = require('mongoose');

const splashScreenSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    videoUrl: { type: String, trim: true },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isEnabled: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

splashScreenSchema.index({ isEnabled: 1, startsAt: 1, endsAt: 1 });
module.exports = mongoose.model('SplashScreen', splashScreenSchema);
