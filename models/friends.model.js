import { Schema, model } from "mongoose";

const friendModel = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    friendId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Friends = model("friend", friendModel);

// get the following to get how many people the user is following: Get people i am following
// count the following to get how many people are following the artist:
