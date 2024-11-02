const mongoose = require("mongoose");

const artistClaimSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "artist",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
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
      type: mongoose.Schema.Types.ObjectId,
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

const ArtistClaim = mongoose.model("artistClaim", artistClaimSchema);
module.exports = ArtistClaim;
