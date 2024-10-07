const mongoose = require("mongoose");

const friendModel = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    friendId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Friends = mongoose.model("friend", friendModel);

module.exports = Friends;

// get the following to get how many people the user is following: Get people i am following
// count the following to get how many people are following the artist:
