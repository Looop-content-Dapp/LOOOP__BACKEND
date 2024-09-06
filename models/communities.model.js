const mongoose = require("mongoose");

const CommunitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  members: { type: String, required: true },
  moderators: { type: Number, required: true },
  backgroundColor: { type: String, required: true },
  artist: { type: String, required: true },
  image: { type: String, required: true },
});

const Community = mongoose.model("communities", CommunitySchema);

module.exports = Community;
