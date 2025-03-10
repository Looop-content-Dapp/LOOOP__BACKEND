import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  artistId: {
    type: mongoose.Types.ObjectId,
    ref: "Artist",
    required: true,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Subscriber = mongoose.model("subscribers", subscriberSchema);
