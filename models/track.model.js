const mongoose = require("mongoose");

const trackSchema = new mongoose.Schema({
    releaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'releases',
      required: true
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'songs',
      required: true
    },
    title: {
      type: String,
      required: true,
      index: 'text'
    },
    version: {
      type: String,
      default: 'Original'
    },
    duration: Number,
    track_number: Number,
    disc_number: {
      type: Number,
      default: 1
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'artists',
      required: true
    },
    // Enhanced metadata
    metadata: {
      genre: [{
        type: String,
        required: true
      }],
      bpm: Number,
      key: String,
      mood: [String],
      tags: [String],
      isrc: String,
      languageCode: String,
      recordingYear: Number,
      recordingLocation: String
    },
    // Enhanced credits system
    credits: [{
      role: String,
      artistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'artists'
      },
      contribution: String,
      primaryContributor: Boolean
    }],
    // Enhanced lyrics system
    lyrics: {
      syncedLyrics: [{
        time: Number,
        text: String
      }],
      plainText: String,
      language: String,
      hasTranslation: Boolean,
      translations: [{
        language: String,
        text: String
      }]
    },
    // Enhanced interaction tracking
    interactions: {
      skipCount: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      averageListenTime: { type: Number, default: 0 },
      playlists: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 }
    },
    // Regional performance
    regionalData: [{
      region: String,
      streams: Number,
      shares: Number,
      playlists: Number,
      skipRate: Number
    }],
    // Content flags
    flags: {
      isExplicit: Boolean,
      isInstrumental: Boolean,
      isLive: Boolean,
      isAcoustic: Boolean,
      isRemix: Boolean,
      hasLyrics: Boolean
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Indexes for efficient querying
trackSchema.index({ title: "text" });
trackSchema.index({ "metadata.genre": 1 });
trackSchema.index({ "metadata.mood": 1 });
trackSchema.index({ "interactions.likes": -1 });
trackSchema.index({ "interactions.shares": -1 });
trackSchema.index({ title: 1 });
trackSchema.index({ artistId: 1 });
trackSchema.index({ releaseId: 1 });

const Track = mongoose.model("tracks", trackSchema);

module.exports = Track;
