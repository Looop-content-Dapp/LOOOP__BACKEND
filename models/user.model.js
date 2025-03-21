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
      starknet: {
        type: {
          address: { type: String, default: null },
          balance: { type: Number, default: 0 },
        },
        default: null,
      },
      xion: {
        type: {
          address: { type: String, required: true },
          mnemonic: { type: String, required: true },
          balance: { type: Number, default: 0 },
        },
        default: null,
      },
    },
    nftContracts: [{
      contractAddress: { type: String, required: true },
      communityId: { type: SchemaTypes.ObjectId, ref: 'Community', required: true },
      mintedAt: { type: Date, default: Date.now }
    }],
    oauthTokens: [{ type: SchemaTypes.ObjectId, ref: "OAuthToken" }],
    artist: { type: SchemaTypes.ObjectId, ref: "artist" },
    referralCode: { type: String, required: true, unique: true },
    referralCount: { type: Number, default: 0 },
    referralCodeUsed: [
      { type: SchemaTypes.ObjectId, ref: "users", default: [] },
    ],
  },
  { timestamps: true }
);

export const User = model("users", userSchema);
