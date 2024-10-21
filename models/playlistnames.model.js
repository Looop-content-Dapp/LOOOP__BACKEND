const mongoose = require("mongoose");

const playListNameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    userId: { type: String, required: true },
    image: { type: String },
    coverImage: { type: String },
    genreId: { type: mongoose.Types.ObjectId },
    createdDate: { type: Date, default: Date.now() },
    isPublic: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const PlayListName = mongoose.model("playListname", playListNameSchema);

module.exports = PlayListName;
