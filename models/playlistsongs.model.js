const mongoose = require("mongoose");

const playListSongSchema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Types.ObjectId, required: true, ref: "Track" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: "PlayListName" },
  },
  { timestamps: true }
);

const PlayListSongs = mongoose.model("playListsongs", playListSongSchema);

module.exports = PlayListSongs;
