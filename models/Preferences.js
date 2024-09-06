const mongoose = require("mongoose");

const PreferenceSchema = new mongoose.Schema(
  {
    peference: { type: String },
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
