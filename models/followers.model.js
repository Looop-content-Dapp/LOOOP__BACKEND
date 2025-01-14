import { Schema, model } from "mongoose";

const followSchema = new Schema({
  follower: {
    type: Schema.Types.ObjectId,
    ref: "Artist",
    required: true,
  }, // get people that follow me
  following: {
    type: Schema.Types.ObjectId,
    ref: "Artist",
    required: true,
  }, // get people that i follow
  followedAt: { type: Date, default: Date.now },
});

export const Follow = model("Follow", followSchema);

// get the following to get how many people the user is following: Get people i am following
// count the following to get how many people are following the artist:
