import mongoose, { Schema } from "mongoose";

const transactionSchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['subscription', 'withdrawal', 'refund'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const platformWalletSchema = new Schema({
  balance: {
    type: Number,
    default: 0,
    validate: {
      validator: function(value) {
        return value >= 0;
      },
      message: 'Balance cannot be negative'
    }
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR']
  },
  transactions: [transactionSchema],
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Static method to update balance with atomic operations
platformWalletSchema.statics.updateBalance = async function(amount, currency, type, description) {
  if (amount > 0) {
    // Increment: No need to check balance
    const result = await this.findOneAndUpdate(
      { currency },
      {
        $inc: { balance: amount, version: 1 },
        $push: {
          transactions: {
            amount,
            currency,
            type,
            description
          }
        }
      },
      { new: true, upsert: true }
    );
    return result;
  } else if (amount < 0) {
    // Decrement: Use conditional update to ensure sufficient balance
    const result = await this.findOneAndUpdate(
      { currency, balance: { $gte: Math.abs(amount) } },
      {
        $inc: { balance: amount, version: 1 },
        $push: {
          transactions: {
            amount,
            currency,
            type,
            description
          }
        }
      },
      { new: true }
    );
    if (!result) throw new Error('Insufficient balance');
    return result;
  } else {
    throw new Error('Amount cannot be zero');
  }
};

// Method to get wallet balance
platformWalletSchema.statics.getBalance = async function(currency = 'USD') {
  const wallet = await this.findOne({ currency }) || await this.create({ balance: 0, currency });
  return wallet.balance;
};

export const PlatformWallet = mongoose.model('platformWallet', platformWalletSchema); 