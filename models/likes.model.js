import { Schema as _Schema, model } from "mongoose";
const Schema = _Schema;

const likeSchema = new Schema({
  userId: {
    type: _Schema.Types.ObjectId,
    ref: "users",  // Changed from "User" to "users"
    required: true,
  },
  postId: {
    type: _Schema.Types.ObjectId,
    refPath: "itemType",
    required: true,
  },
  itemType: {
    type: String,
    required: true,
    enum: ["post", "comment"], // Different types of items users can like
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Like = model("Like", likeSchema);
