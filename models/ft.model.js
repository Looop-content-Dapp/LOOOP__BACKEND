const mongoose = require("mongoose");

const ftSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
  },
  { timestamps: true }
);

const FT = mongoose.model("ft", ftSchema);

module.exports = FT;
