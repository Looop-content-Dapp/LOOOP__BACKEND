const mongoose = require("mongoose");

const LastPlayedSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
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

const LastPlayed = mongoose.model("lastPlayyed", LastPlayedSchema);

module.exports = LastPlayed;
