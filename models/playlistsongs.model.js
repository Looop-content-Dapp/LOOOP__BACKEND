import { Schema, Types, model } from "mongoose";

const playListSongSchema = new Schema(
  {
    trackId: { type: Types.ObjectId, required: true, ref: "Track" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    playlistId: { type: Schema.Types.ObjectId, ref: "PlayListName" },
  },
  { timestamps: true }
);

export const PlayListSongs = model("playListsongs", playListSongSchema);

