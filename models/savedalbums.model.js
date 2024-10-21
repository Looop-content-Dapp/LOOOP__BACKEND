const mongoose = require("mongoose");

const SavedReleaseSchema = new mongoose.Schema(
  {
    releaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const SavedRelease = mongoose.model("savedreleases", SavedReleaseSchema);

module.exports = SavedRelease;
