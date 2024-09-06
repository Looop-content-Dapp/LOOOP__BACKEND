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

const Artist = mongoose.model("artist", artistSchema);

module.exports = Artist;
