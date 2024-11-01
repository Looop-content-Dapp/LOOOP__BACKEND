const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
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

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
