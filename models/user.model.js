import { Schema, SchemaTypes, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    fullname: { type: String, required: true },
    age: { type: String, required: true },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female"],
    },
    password: { type: String },
    profileImage: { type: String, default: null },
    bio: { type: String, default: null },
    isPremium: { type: Boolean, default: false },
    tel: { type: Number, default: null },
    role: {
      type: String,
      enum: ["LISTENER", "ARTIST", "ADMIN"],
      default: "LISTENER",
    },
    wallets: {
      starknet: { type: String, default: null },
      xion: { type: String, default: null },
    },
    oauthTokens: [{ type: SchemaTypes.ObjectId, ref: "OAuthToken" }],
    artist: { type: SchemaTypes.ObjectId, ref: "artist" },
  },
  { timestamps: true }
);

export const User = model("users", userSchema);
