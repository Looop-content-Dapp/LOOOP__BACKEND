const mongoose = require("mongoose");

const LastPlayyedSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },
  },
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const LastPlayyed = mongoose.model("lastPlayyed", LastPlayyedSchema);

module.exports = LastPlayyed;
