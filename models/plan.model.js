import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema(
  {
    artistId: { type: String, required: true }, // Unique artist identifier
    tribeId: { type: String, required: true }, // Unique tribe/community identifier
    name: { type: String, required: true }, // e.g., "Basic Tribe Access"
    amount: {
      type: Number,
      required: true["amount is required"],
      min: (0)["amount must be greater than 0"],
    }, // Monthly subscription amount
    currency: { type: String, enum: ["NGN", "USD"], default: "NGN" },
    description: { type: String },
    flutterwavePlanId: { type: String }, // Flutterwave plan ID after creation
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", PlanSchema);

export default Plan;
