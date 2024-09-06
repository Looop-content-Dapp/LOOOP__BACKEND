const mongoose = require("mongoose");

const playListNameSchema = new mongoose.Schema(
  {
    title: { type: String },
    user_id: { type: String },
    created_date: { type: Date },
  },
  { timestamps: true }
);

const PlayListName = mongoose.model("playListname", playListNameSchema);

module.exports = PlayListName;
