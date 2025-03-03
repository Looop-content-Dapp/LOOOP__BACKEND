import { Schema, model } from "mongoose";

const songSchema = new Schema({
    fileUrl: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    bitrate: {
      type: Number,
      required: true,
    },
    format: {
      type: String,
      enum: ['mp3', 'wav', 'aac', 'flac'],
      required: true,
    },
    // Enhanced analytics tracking
    analytics: {
      totalStreams: { type: Number, default: 0 },
      uniqueListeners: { type: Number, default: 0 },
      playlistAdditions: { type: Number, default: 0 },
      shares: {
        total: { type: Number, default: 0 },
        platforms: {
          facebook: { type: Number, default: 0 },
          twitter: { type: Number, default: 0 },
          whatsapp: { type: Number, default: 0 },
          other: { type: Number, default: 0 }
        }
      },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 }
    },
    // Enhanced stream history tracking
    streamHistory: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'users'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      deviceType: String,
      quality: String,
      region: String,
      completionRate: Number, // Percentage of song listened
      sessionDuration: Number, // Time spent in seconds
      skipped: Boolean,
      offline: Boolean
    }],
    // Enhanced engagement tracking
    engagement: {
      skipRate: Number, // Percentage of times song is skipped
      averageCompletionRate: Number, // Average percentage listened
      repeatListenRate: Number, // How often users replay the song
      peakListeningTimes: [{ // Popular listening hours
        hour: Number,
        count: Number
      }]
    },
    playlists: [{
      playlistId: {
        type: Schema.Types.ObjectId,
        ref: 'playlists'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    waveform: {
      type: [Number],
      default: []
    },
    lyrics: {
      type: String,
      default: ""
    },
    isrc: {
      type: String,
      unique: true
    },
    // Quality metrics
    audioQuality: {
      peak: Number,
      averageVolume: Number,
      dynamicRange: Number
    },
    // Content flags
    flags: {
      isExplicit: { type: Boolean, default: false },
      containsExplicitLanguage: { type: Boolean, default: false },
      isInstrumental: { type: Boolean, default: false },
      hasLyrics: { type: Boolean, default: true }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Virtual for calculating engagement score
songSchema.virtual('engagementScore').get(function() {
    return (
        (this.analytics.totalStreams * 1) +
        (this.analytics.playlistAdditions * 2) +
        (this.analytics.shares.total * 3) +
        (this.analytics.likes * 1.5) +
        (this.analytics.comments * 2)
    );
});

// Index for searching and sorting
songSchema.index({
    'analytics.totalStreams': -1,
    'analytics.playlistAdditions': -1,
    'analytics.shares.total': -1,
    'engagement.skipRate': 1
});
songSchema.index({ 'fileUrl': 1 }); // For basic queries
songSchema.index({ 'streamHistory.timestamp': -1 }); // For streaming history queries
songSchema.index({ 'streamHistory.userId': 1, 'streamHistory.timestamp': -1 }); // For user history
songSchema.index({ 'playlists.playlistId': 1 }); // For playlist queries







export const Song = model("songs", songSchema);



