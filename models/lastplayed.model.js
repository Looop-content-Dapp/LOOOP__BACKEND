import { Schema, model } from "mongoose";

const LastPlayedSchema = new Schema(
  {
    trackId: {
      type: Schema.Types.ObjectId,
      ref: "Track",
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

export const LastPlayed = model("lastPlayyed", LastPlayedSchema);

