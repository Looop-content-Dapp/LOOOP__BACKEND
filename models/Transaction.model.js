import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  referenceId: { type: String, unique: false, sparse: false },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  usdcEquivalent: { type: Number, required: false },
  transactionHash: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paymentMethod: { type: String, enum: ['card', 'applepay', 'wallet'], required: true },
  type: { type: String, enum: ['funding', 'mint_pass', 'transfer'], default: 'funding' },
  source: { type: String, enum: ['card', 'applepay', 'wallet'], default: 'wallet' },
  blockchain: { type: String, enum: ['Starknet', 'XION'], required: true },
  title: { type: String },
  message: { type: String },
  metadata: {
    communityId: { type: String },
    communityName: { type: String },
    passId: { type: String }
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Add compound index for faster queries
TransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', TransactionSchema);

export default Transaction;
