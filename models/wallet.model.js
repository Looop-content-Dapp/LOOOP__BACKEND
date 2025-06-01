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
    starknet: {
      type: {
        address: { type: String, default: null },
        encryptedPrivateKey: { type: String, default: null },
        iv: { type: String, default: null },
        salt: { type: String, default: null },
        isDeployed: { type: Boolean, default: false },
        constructorCalldata: { type: Array, default: [] },
        addressSalt: { type: String, default: null },
        classHash: { type: String, default: null }
      },
      default: null,
    },
    recoveryToken: { type: String, default: null },
    recoveryTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for faster queries
walletSchema.index({ email: 1 });

export const Wallet = model("wallets", walletSchema);
