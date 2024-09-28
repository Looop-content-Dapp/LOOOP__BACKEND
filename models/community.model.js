const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  createdBy: { type: mongoose.Types.ObjectId, ref: "Artist" }, // the member who created the community
  createdAt: { type: Date, default: Date.now },
});

communitySchema.index({ name: "text" });

const Community = mongoose.model("community", communitySchema);

module.exports = Community;
