import mongoose from "mongoose";

const ClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    status: {
      type: String,
      enum: ["pending", "claimed", "expired"],
      default: "pending",
    },
    signature: { type: String },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const Claim = mongoose.model("Claim", ClaimSchema);

export default Claim;
