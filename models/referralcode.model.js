import mongoose from "mongoose";

const { Schema, model } = mongoose;

const referralCodeSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  rewardPoints: {
    type: Number,
    default: 0,
  },
  rewardsHistory: [
    {
      points: Number,
      reason: String,
      date: { type: Date, default: Date.now },
    },
  ],
});

export const ReferralCode = model("ReferralCode", referralCodeSchema);
