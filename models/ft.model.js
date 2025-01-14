import { Schema, model } from "mongoose";

const ftSchema = new Schema({
    trackId: {
      type: Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    // Enhanced featuring details
    contribution: {
      type: String,
      enum: ['vocals', 'verse', 'chorus', 'bridge', 'production', 'remix', 'other'],
      required: true
    },
    // Position in track where feature appears
    placement: [{
      startTime: Number, // in seconds
      endTime: Number,
      type: String // verse, chorus, etc.
    }],
    // Credit and recognition
    credits: {
      billingOrder: Number, // Order in which artist appears in credits
      displayName: String, // How artist name should appear
      primaryArtist: Boolean,
      featured: Boolean,
      uncredited: Boolean
    },
    // Collaboration details
    collaboration: {
      contractId: String,
      revenueShare: Number,
      clearanceDate: Date,
      terms: [String]
    },
    // Performance metrics
    metrics: {
      streams: { type: Number, default: 0 },
      uniqueListeners: { type: Number, default: 0 },
      skipRate: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      fanOverlap: { type: Number, default: 0 } // Percentage of listeners who follow both artists
    },
    // Social impact
    social: {
      mentions: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      playlists: { type: Number, default: 0 }
    },
    // Regional performance
    regionalPerformance: [{
      region: String,
      streams: Number,
      engagement: Number
    }],
    // Additional metadata
    metadata: {
      language: String,
      recorded: Date,
      studio: String,
      producer: String
    },
    // Rights and licensing
    rights: {
      territories: [String],
      restrictions: [String],
      clearanceStatus: {
        type: String,
        enum: ['pending', 'cleared', 'rejected', 'expired'],
        default: 'pending'
      }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Indexes for efficient querying
ftSchema.index({ trackId: 1, artistId: 1 }, { unique: true });
ftSchema.index({ "metrics.streams": -1 });
ftSchema.index({ "collaboration.clearanceDate": 1 });

// Virtual for calculating feature impact
ftSchema.virtual('featureImpact').get(function() {
    return (
        (this.metrics.streams * 0.4) +
        (this.metrics.completionRate * 0.3) +
        (this.metrics.fanOverlap * 0.3)
    );
});

export const FT = model("ft", ftSchema);
