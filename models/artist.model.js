const mongoose = require("mongoose");

const artistSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, unique: true, required: true },
    profileImage: { type: String },
    password: { type: String, required: true },
    bio: { type: String },
    genre: { type: String, required: true },
    addinationalInfo: { type: String, defaultValue: "" },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

artistSchema.index({ name: 1, genre: -1 });
artistSchema.index({ name: 'text' }); // For text search on artist names
artistSchema.index({ genre: 1 }); // For genre filtering
artistSchema.index({ verified: 1 }); // For verified artist filtering
artistSchema.index({ createdAt: -1 }); // For sorting by newest
artistSchema.index({ email: 1 }, { unique: true }); // For unique email constraint

const Artist = mongoose.model("artist", artistSchema);

module.exports = Artist;
