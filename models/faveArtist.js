const mongoose = require("mongoose");

const faveArtistSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const FaveArtist = mongoose.model("faveArtists", faveArtistSchema);

module.exports = FaveArtist;
