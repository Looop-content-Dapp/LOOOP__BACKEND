const mongoose = require("mongoose");
const { Schema } = mongoose;

const memberSchema = new Schema({
  userId: { type: mongoose.Types.ObjectId, ref: "User", required: true }, // references to communities the user has joined
  communityId: {
    type: mongoose.Types.ObjectId,
    ref: "Community",
    required: true,
  },
  joinDate: { type: Date, default: Date.now },
});

const CommunityMember = mongoose.model("communitymember", memberSchema);

module.exports = CommunityMember;
