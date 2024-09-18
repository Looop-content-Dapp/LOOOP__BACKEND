const { default: mongoose } = require("mongoose");

const subscriberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User", // Assuming there's a User model
    required: true,
  },
  artistId: {
    type: mongoose.Types.ObjectId,
    ref: "Artist",
    required: true,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
});

const Subscriber = mongoose.model("subscribers", subscriberSchema);
module.exports = Subscriber;
