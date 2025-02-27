import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    artistId: { type: String, required: true },
    tribeId: { type: String, required: true },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    }, // Reference to Plan
    amount: {
      type: Number,
      required: true["amount is required"],
      min: (0)["amount must be greater than 0"],
    },
    currency: { type: String, enum: ["NGN", "USD"], default: "USD" },
    paymentMethod: { type: String, enum: ["card", "applepay"], required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
    nextBillingDate: { type: Date },
    gracePeriodEnd: { type: Date },
    nftTokenId: { type: String },
    flutterwaveSubscriptionId: { type: String }, // Flutterwave subscription ID
  },
  { timestamps: true }
);

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;
