import { Schema, model } from "mongoose";

const socialLinksSchema = new Schema({
  spotify: String,
  instagram: String,
  twitter: String,
  facebook: String,
  website: String,
});

const artistSchema = new Schema(
  {
    artistId: {
      type: String,
      required: false,
      default: null,
      index: true,
      sparse: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: false,
      default: null
    },
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    profileImage: {
      type: String,
      required: true,
      default: null,
      unique: false,
    },
    biography: { type: String, required: true, default: null },
    address1: { type: String, required: true, default: null },
    address2: { type: String, required: false, default: null },
    country: { type: String, required: true, default: null },
    postalcode: { type: String, required: false, default: null },
    city: { type: String, required: true, default: null },
    websiteurl: { type: String, required: false, default: null },
    monthlyListeners: { type: Number, default: 0 },
    followers: { type: Number, default: 0 }, // Simplified followers field
    isFollowed: {
      type: Boolean,
      default: false,
    },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    socialLinks: socialLinksSchema,
    popularity: { type: Number, min: 0, max: 100, default: 0 },
    topTracks: [
      {
        id: String,
        name: String,
        duration: Number,
        playCount: { type: Number, default: 0 },
      },
    ],
    roles: [
      {
        type: String,
        enum: ["singer", "songwriter", "producer", "musician"],
      },
    ],
    labels: [String],
    isActive: { type: Boolean, default: true },
    genres: [{ type: Schema.Types.ObjectId, ref: "genres", required: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Add virtual for isFollowed
artistSchema.virtual('isFollowedByUser').get(function() {
  return this.isFollowed;
});

// Indexes
// artistSchema.index({ name: "text", biography: "text" });
// artistSchema.index({ genres: 1 });
// artistSchema.index({ popularity: -1 });
// artistSchema.index({ monthlyListeners: -1 });
// artistSchema.index({ verified: 1 });
// artistSchema.index({ country: 1 });
// artistSchema.index({ "albums.releaseDate": -1 });

export const Artist = model("artist", artistSchema);
