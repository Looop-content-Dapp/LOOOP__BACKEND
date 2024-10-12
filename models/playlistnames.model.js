const mongoose = require("mongoose");

const playListNameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    userId: { type: String, required: true },
    image: { type: String, required: true },
    coverImage: { type: String, required: true },
    genreId: { type: mongoose.Types.ObjectId, required: true },
    createdDate: { type: Date, default: Date.now() },
    isPublic: { type: Boolean, default: false },
    isPinned: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

const PlayListName = mongoose.model("playListname", playListNameSchema);

module.exports = PlayListName;
