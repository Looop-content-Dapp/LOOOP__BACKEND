import { Schema, model } from "mongoose";

const walletSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    xion: {
      type: {
        address: { type: String, default: null },
        encryptedMnemonic: { type: String, default: null },
        iv: { type: String, default: null },
        salt: { type: String, default: null },
      },
      default: null,
    },
    recoveryToken: { type: String, default: null },
    recoveryTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Wallet = model("wallets", walletSchema);
