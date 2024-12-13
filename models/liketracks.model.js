import { Schema, model } from "mongoose";

const liketracksSchema = new Schema(
  {
    trackId: {
      type: Schema.Types.ObjectId,
      ref: "Album",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const LikeTracks = model("liketracks", liketracksSchema);
