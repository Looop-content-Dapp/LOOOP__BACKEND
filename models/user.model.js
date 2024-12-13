import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "" },
    isPremium: { type: Boolean, default: false },
    tel: { type: Number },
  },
  { timestamps: true }
);

export const User = model("users", userSchema);
