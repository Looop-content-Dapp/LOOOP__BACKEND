import { Schema, SchemaTypes, model } from "mongoose";

const userSchema = new Schema(
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
    },
    oauthTokens: [{ type: SchemaTypes.ObjectId, ref: 'OAuthToken' }], // Reference to OAuth tokens
  },
  { timestamps: true }
);

export const User = model("users", userSchema);
