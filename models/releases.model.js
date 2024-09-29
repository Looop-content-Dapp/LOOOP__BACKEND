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
  genre: {
    type: String,
    required: true,
  },
  label: {
    type: String,
  },
  type: {
    type: String,
    enum: ["single", "album", "ep"],
    required: true,
  },
  artistId: {
    type: mongoose.Types.ObjectId,
  },
});

releaseSchema.index({ title: "text" });

const Release = mongoose.model("releases", releaseSchema);

module.exports = Release;
