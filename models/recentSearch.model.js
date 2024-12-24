import { Schema, model } from 'mongoose';

const recentSearchSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  query: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create compound index for efficient querying
recentSearchSchema.index({ userId: 1, timestamp: -1 });

export const RecentSearch = model('RecentSearch', recentSearchSchema);
