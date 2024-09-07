const { default: mongoose } = require("mongoose");

const commentSchema = new Schema({
  content: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "Member" },
  post: { type: mongoose.Types.ObjectId, ref: "Post" },
  createdAt: { type: Date, default: Date.now },
});

const Comment = mongoose.model("Comment", commentSchema);
