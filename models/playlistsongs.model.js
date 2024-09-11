const mongoose = require("mongoose");

const playListSongSchema = new mongoose.Schema(
  {
    releaseId: { type: mongoose.Types.ObjectId, required: true, ref: "Song" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: "PlayListName" },
  },
  { timestamps: true }
);

const PlayListSongs = mongoose.model("playListsongs", playListSongSchema);

module.exports = PlayListSongs;
