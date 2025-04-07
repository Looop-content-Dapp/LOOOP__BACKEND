import mongoose, { Schema } from "mongoose";

const passSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
  communityId: { type: Schema.Types.ObjectId, ref: "community", required: true },
  contractAddress: { type: String, required: true },
  tokenId: { type: String, required: true },
  status: {
    type: String,
    enum: ["active", "inactive", "burnt", "pending_renewal", "expired"],
    default: "active"
  },
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  lastRenewalDate: { type: Date, default: Date.now },
  renewalPrice: { type: Number, required: true },
  currency: { type: String, default: "USDC" },
  collectibelType: { type: String, default: "Tribe Pass" },
  paymentStatus: {
    type: String,
    enum: ["paid", "pending", "failed"],
    default: "pending"
  },
  paymentMethod: String,
  transactionHash: String,
  nextRenewalDate: Date,
  renewalCount: { type: Number, default: 0 },
  usageStats: {
    lastUsed: Date,
    usageCount: { type: Number, default: 0 }
  },
  notifications: [{
    type: {
      type: String,
      enum: ["renewal_reminder", "payment_success", "payment_failed", "expiry_warning"]
    },
    sentAt: Date,
    read: { type: Boolean, default: false }
  }],
  metadata: Schema.Types.Mixed // For storing additional custom data
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for remaining days
passSubscriptionSchema.virtual('remainingDays').get(function() {
  return Math.ceil((this.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
});

// Indexes for faster queries
passSubscriptionSchema.index({ userId: 1, status: 1 });
passSubscriptionSchema.index({ expiryDate: 1 });
passSubscriptionSchema.index({ contractAddress: 1, tokenId: 1 }, { unique: true });

export const PassSubscription = mongoose.model("passsubscription", passSubscriptionSchema);
