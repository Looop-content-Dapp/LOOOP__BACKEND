import { Schema, model } from "mongoose";

const faveArtistSchema = new Schema(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const FaveArtist = model("faveArtists", faveArtistSchema);
