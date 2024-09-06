const mongoose = require("mongoose");

const socialSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
    twitter: { type: String },
    linkedin: { type: String },
    instagram: { type: String },
  },
  { timestamps: true }
);

const Social = mongoose.model("socials", socialSchema);

module.exports = Social;
