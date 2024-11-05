const mongoose = require("mongoose");

const playListNameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    userId: { type: String, required: true },
    coverImage: {
      type: String,
      default: null, // Will be auto-generated based on songs
    },
    dominantGenre: {
      type: mongoose.Types.ObjectId,
      ref: "Genre",
      default: null, // Will be calculated from songs
    },
    genreDistribution: {
      type: Map,
      of: Number,
      default: new Map(), // Keeps track of genre percentages
    },
    createdDate: { type: Date, default: Date.now() },
    isPublic: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    followerCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    totalTracks: { type: Number, default: 0 },
    lastModified: { type: Date, default: Date.now() },
    collaborators: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    isCollaborative: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playListNameSchema.index({ title: 1 });
playListNameSchema.index({ description: 1 });

const PlayListName = mongoose.model("playListname", playListNameSchema);

module.exports = PlayListName;
