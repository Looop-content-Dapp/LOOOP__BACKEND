const mongoose = require("mongoose");

const liketracksSchema = new mongoose.Schema(
  {
    trackId: {
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

const LikeTracks = mongoose.model("liketracks", liketracksSchema);

module.exports = LikeTracks;
