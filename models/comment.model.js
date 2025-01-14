import { Schema as _Schema, model } from "mongoose";
const Schema = _Schema;

const commentSchema = new Schema({
  userId: {
    type: _Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  postId: {
    type: _Schema.Types.ObjectId,
    refPath: "Post",
    required: true,
  },
  itemType: {
    type: String,
    required: true,
    enum: ["comment", "reply"], // Adjust this to match your content models
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000, // Limiting comment length
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Comment = model("Comment", commentSchema);
