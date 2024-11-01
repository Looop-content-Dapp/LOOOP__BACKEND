const mongoose = require("mongoose");

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
  thumbnailUrl: String,
  duration: Number,
  mimeType: String,
  size: Number,
  width: Number,
  height: Number,
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
      ref: "artist", // Changed to match your artist model name
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
    genre: { type: String }, // Added to match artist model pattern
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
