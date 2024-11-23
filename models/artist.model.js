const mongoose = require("mongoose");

const socialLinksSchema = new mongoose.Schema({
  spotify: String,
  instagram: String,
  twitter: String,
  facebook: String,
  website: String
});

const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    artistId: { type: String, required: true, unique: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    images: [{
      url: String,
      height: Number,
      width: Number
    }],
    genres: [{ type: String }],
    biography: { type: String },
    monthlyListeners: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    socialLinks: socialLinksSchema,
    popularity: { type: Number, min: 0, max: 100, default: 0 },
    topTracks: [{
      id: String,
      name: String,
      duration: Number,
      playCount: { type: Number, default: 0 }
    }],
    roles: [{
      type: String,
      enum: ['singer', 'songwriter', 'producer', 'musician']
    }],
    labels: [String],
    country: String,
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

// Indexes
artistSchema.index({ name: 'text', biography: 'text' });
artistSchema.index({ genres: 1 });
artistSchema.index({ popularity: -1 });
artistSchema.index({ monthlyListeners: -1 });
artistSchema.index({ verified: 1 });
artistSchema.index({ country: 1 });
artistSchema.index({ 'albums.releaseDate': -1 });

const Artist = mongoose.model("artist", artistSchema);

module.exports = Artist;
