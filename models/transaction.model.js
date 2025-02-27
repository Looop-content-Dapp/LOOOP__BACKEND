import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    amount: {
      type: Number,
      required: true["transaction amount is required"],
      min: (0)["transaction amount cannot be 0"],
    },
    currency: { type: String, required: true["currency is required"] },
    usdcEquivalent: { type: Number },
    transactionHash: { type: String },
    status: {
      type: String,
      enum: ["success", "pending", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true["payment method is required! please specify"],
    },
    flutterwaveTxRef: { type: String },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", TransactionSchema);

export default Transaction;
