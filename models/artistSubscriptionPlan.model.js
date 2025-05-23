import { Schema, model } from "mongoose";

const priceSchema = new Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  }
});

const splitPercentageSchema = new Schema({
  platform: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  artist: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  }
});

const artistSubscriptionPlanSchema = new Schema(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'artist',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    price: {
      type: priceSchema,
      required: true
    },
    benefits: [{
      type: String,
      required: true
    }],
    duration: {
      type: Number,
      required: true,
      min: 1,
      default: 30 // Default to 30 days
    },
    splitPercentage: {
      type: splitPercentageSchema,
      required: true,
      default: () => ({
        platform: 20,
        artist: 80
      })
    },
    isActive: {
      type: Boolean,
      default: true
    },
    subscriberCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Validate that platform + artist percentages equal 100
artistSubscriptionPlanSchema.pre('save', function(next) {
  if (this.splitPercentage.platform + this.splitPercentage.artist !== 100) {
    next(new Error('Platform and artist percentages must sum to 100'));
  }
  next();
});

export const ArtistSubscriptionPlan = model('artistSubscriptionPlan', artistSubscriptionPlanSchema); 