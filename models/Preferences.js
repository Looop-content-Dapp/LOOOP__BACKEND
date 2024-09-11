const mongoose = require("mongoose");

const PreferenceSchema = new mongoose.Schema(
  {
    genreId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Genre",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Preferences = mongoose.model("preferences", PreferenceSchema);

module.exports = Preferences;
