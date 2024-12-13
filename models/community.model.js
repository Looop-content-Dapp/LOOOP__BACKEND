import { Schema, Types, model } from "mongoose";

const communitySchema = new Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 150 // Based on UI character limit
  },
  coverImage: {
    type: String,
    required: true // Required based on UI
  },

  // Membership/Tribe Pass Details
  tribePass: {
    collectibleName: {
      type: String,
      required: true,
      trim: true
    },
    collectibleDescription: {
      type: String,
      maxlength: 150,
      trim: true
    },
    collectibleImage: {
      type: String,
      required: true
    },
    collectibleType: {
      type: String,
      enum: ['PNG', 'GIF', 'WEBP'],
      required: false
    }
  },

  // Community Status and Meta
  createdBy: {
    type: Types.ObjectId,
    ref: "artist",
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive'],
    default: 'active'
  },
  memberCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

communitySchema.index({ name: "text" });

export const Community = model("community", communitySchema);
