const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    initialPassword: {
      type: String,
      select: false
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER
    },
    profile: {
      phone: String,
      mobile: String,
      whatsapp: String,
      photo: String,
      address: String,
      city: String,
      state: String,
      pinCode: String,
      gender: { type: String, enum: ['male', 'female', 'other'] },
      dateOfBirth: Date,
      age: Number,
      qualification: String,
      experience: String,
      specialization: String,
      subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
      designation: String,
      biography: String,
      joiningDate: Date,
      salary: Number,
      aadhaar: String,
      pan: String,
      resume: String,
      certificates: [String],
      documents: [String],
      parentDetails: { name: String, phone: String, email: String },
      fatherName: String,
      motherName: String,
      guardianDetails: { name: String, phone: String, relation: String },
      emergencyContact: { name: String, phone: String, relation: String },
      assignedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
      assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
      enrolledCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      enrolledSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
      educationQualification: String,
      schoolCollege: String,
      currentClass: String,
      admissionDate: Date,
      purchasedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
      paymentStatus: String,
      feeDetails: {
        total: Number,
        discount: Number,
        paid: Number,
        remaining: Number
      },
      signature: String,
      studentStatus: String,
      attendance: { type: mongoose.Schema.Types.Mixed, default: {} },
      batch: String,
      rollNumber: String,
      examHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
      achievements: [String],
      notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AcademyRecord' }],
      remarks: String,
      bankDetails: {
        bankName: String,
        accountHolder: String,
        accountNumber: String,
        ifsc: String,
        upiId: String
      },
      orientation: {
        academyRules: String,
        teachingGuidelines: String,
        responsibilities: String,
        attendanceRules: String,
        onlineTeachingGuidelines: String,
        leavePolicy: String,
        codeOfConduct: String,
        digitalResources: [String]
      }
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: Date
    ,createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ,updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ,isDeleted: { type: Boolean, default: false, index: true }
    ,deletedAt: Date
    ,deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ,restoredAt: Date
    ,restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
