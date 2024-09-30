const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artist",
    required: true,
  }, // get people that follow me
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artist",
    required: true,
  }, // get people that i follow
  followedAt: { type: Date, default: Date.now },
});

const Follow = mongoose.model("Follow", followSchema);

module.exports = Follow;

// get the following to get how many people the user is following: Get people i am following
// count the following to get how many people are following the artist:
