const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "" },
    isPremium: { type: Boolean, default: false },
    tel: { type: Number },
    role: {
      type: String,
      enum: ['LISTENER', 'ARTIST', 'ADMIN'],
      default: 'LISTENER'
    }
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

module.exports = User;
