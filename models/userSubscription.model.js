import { Schema, model } from "mongoose";

const paymentHistorySchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const userSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'artistSubscriptionPlan',
      required: true
    },
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'artist',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'cancelled', 'expired'],
      default: 'pending'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: true
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    cancellationDate: {
      type: Date,
      default: null
    },
    paymentHistory: [paymentHistorySchema]
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
userSubscriptionSchema.index({ userId: 1, artistId: 1 });
userSubscriptionSchema.index({ status: 1 });
userSubscriptionSchema.index({ endDate: 1 });

// Validate that user can't have multiple active subscriptions to the same artist
userSubscriptionSchema.pre('save', async function(next) {
  if (this.status === 'active') {
    const existingSubscription = await this.constructor.findOne({
      userId: this.userId,
      artistId: this.artistId,
      status: 'active',
      _id: { $ne: this._id }
    });

    if (existingSubscription) {
      next(new Error('User already has an active subscription to this artist'));
    }
  }
  next();
});

export const UserSubscription = model('userSubscription', userSubscriptionSchema); 