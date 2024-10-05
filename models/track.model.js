const mongoose = require("mongoose");

const trackSchema = new mongoose.Schema({
  releaseId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Release",
  },
  title: {
    type: String,
    required: true,
  },
  duration: {
    type: String, // You can also use a more precise time format if desired
    required: true,
  },
  track_number: {
    type: Number,
    required: true,
  },
  artistId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Artist",
  },
  songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
  genre: {
    type: String,
    required: true,
  },
  ft: { type: String, ref: "Artist" },
});

trackSchema.index({ title: "text" });

const Track = mongoose.model("tracks", trackSchema);

module.exports = Track;
