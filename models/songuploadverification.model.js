import { Schema, model } from "mongoose";

const uploadVerificationSchema = new Schema({
  songId: {
    type: Schema.Types.ObjectId,
    ref: 'songs',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderatorId: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  moderationNotes: String,
  rejectionReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  verifiedAt: Date,
  metadata: {
    fileHash: String,
    fileSize: Number,
    qualityCheck: {
      passed: Boolean,
      issues: [String]
    }
  }
}, {
  timestamps: true
});



export const UploadVerification = model("uploadVerification", uploadVerificationSchema);