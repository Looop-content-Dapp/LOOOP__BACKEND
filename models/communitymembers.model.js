import mongoose, { Types, model } from "mongoose";
const { Schema } = mongoose;

const memberSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "users", required: true }, // Changed from "User" to "users"
  communityId: {
    type: Types.ObjectId,
    ref: "Community",
    required: true,
  },
  joinDate: { type: Date, default: Date.now },
});

export const CommunityMember = model("communitymember", memberSchema);
