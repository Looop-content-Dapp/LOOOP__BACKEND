const mongoose = require("mongoose");

const releaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  release_date: {
    type: Date,
    required: true,
  },
  cover_image: {
    type: String,
  },
  number_of_streams: {
    type: Number,
    default: 0,
  },
  genre: {
    type: String,
    required: true,
  },
  label: {
    type: String,
  },
  type: {
    type: String,
    enum: ["song", "album", "ep"],
    required: true,
  },
  artistId: {
    type: mongoose.Types.ObjectId,
  },
});

const Release = mongoose.model("releases", releaseSchema);

module.exports = Release;
