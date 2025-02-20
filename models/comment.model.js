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
    ref: "Post",
    required: true,
  },
  parentCommentId: {
    type: _Schema.Types.ObjectId,
    ref: "Comment",
    default: null,
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

// Helper method to check if comment is a reply
commentSchema.virtual('isReply').get(function() {
  return this.parentCommentId !== null;
});

export const Comment = model("Comment", commentSchema);