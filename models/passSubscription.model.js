import mongoose, { Schema } from "mongoose";

const passSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
  communityId: { type: Schema.Types.ObjectId, ref: "community", required: true },
  contractAddress: { type: String, required: true },
  tokenId: { type: String, required: true },
  status: {
    type: String,
    enum: ["active", "inactive", "burnt"],
    default: "active"
  },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  lastRenewalDate: { type: Date, default: Date.now },
  renewalPrice: { type: Number, required: true },
  currency: { type: String, default: "USDC" }
}, {
  timestamps: true
});

export const PassSubscription = mongoose.model("passsubscription", passSubscriptionSchema);
