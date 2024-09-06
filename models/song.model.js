const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  fileUrl: {
    type: String,
    required: true,
  },
});

const Song = mongoose.model("songs", songSchema);

module.exports = Song;
