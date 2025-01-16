import { Schema, model } from "mongoose";

const artistClaimSchema = new Schema(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "artist",
      required: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "not-submitted"],
      default: "not-submitted",
    },
    verificationDocuments: {
      type: Object,
      required: true,
      enum: [
        "email",
        "profileImage",
        "genres",
        "address1",
        "country",
        "city",
        "postalcode",
        "websiteurl",
      ],
    },

    socialMediaHandles: {
      instagram: String,
      twitter: String,
      tiktok: String,
    },
    websiteUrl: String,
    rejectionReason: String,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "admin",
    },
    verifiedAt: Date,
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const ArtistClaim = model("artistClaim", artistClaimSchema);
