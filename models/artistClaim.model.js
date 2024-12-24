import { Schema, model } from "mongoose";

const artistClaimSchema = new Schema(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "artist",
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    verificationDocuments: [{
      type: {
        type: String,
        required: true,
        enum: ["id", "socialMedia", "website", "pressKit", "other"]
      },
      url: {
        type: String,
        required: true
      },
      description: String
    }],
    socialMediaHandles: {
      instagram: String,
      twitter: String,
      facebook: String,
      spotify: String,
      appleMusic: String,
      soundcloud: String,
      youtube: String
    },
    websiteUrl: String,
    rejectionReason: String,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "admin"
    },
    verifiedAt: Date,
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const ArtistClaim = model("artistClaim", artistClaimSchema);
