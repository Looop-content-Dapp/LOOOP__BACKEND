const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  fileUrl: {
    type: String,
    required: true,
  },
  streams: {
    type: Number,
    default: 0,
  },
  playlistAdditions: {
    type: Number,
    default: 0,
  },
  shares: {
    type: Number,
    default: 0,
  },
});

const Song = mongoose.model("songs", songSchema);

module.exports = Song;
