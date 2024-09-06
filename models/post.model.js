const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
  },
  { timestamps: true }
);

const Artist = mongoose.model("artist", PostSchema);

module.exports = Artist;
