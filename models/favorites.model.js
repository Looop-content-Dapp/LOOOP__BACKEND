import { Schema, model } from "mongoose";

const favoriteSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  tracks: [{
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'tracks'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  releases: [{
    releaseId: {
      type: Schema.Types.ObjectId,
      ref: 'releases'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

// Indexes for better query performance
favoriteSchema.index({ userId: 1 });
favoriteSchema.index({ 'tracks.trackId': 1 });
favoriteSchema.index({ 'releases.releaseId': 1 });

export const Favorites = model('favorites', favoriteSchema);
