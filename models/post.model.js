const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['image', 'video', 'audio', 'gif']
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: String, // For videos
  duration: Number, // For audio/video
  mimeType: String,
  size: Number, // in bytes
  width: Number, // for images/videos
  height: Number, // for images/videos
});

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['single', 'multiple', 'album'],
      default: 'single'
    },
    media: [MediaSchema],
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
    tags: [{ type: String }],
    category: {
      type: String,
      required: true,
      enum: ['artwork', 'music', 'photography', 'design', 'other']
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    createdAt: { type: Date, default: Date.now() },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate for comments and likes
PostSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'postId'
  });

  PostSchema.virtual('likes', {
    ref: 'Like',
    localField: '_id',
    foreignField: 'postId'
  });

  const Post = mongoose.model("posts", PostSchema);

  module.exports = Post;
