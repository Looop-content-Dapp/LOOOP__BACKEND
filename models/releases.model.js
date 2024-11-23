const mongoose = require("mongoose");

const releaseSchema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
      index: 'text'
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'artists',
      required: true
    },
    type: {
      type: String,
      enum: ['single', 'ep', 'album', 'compilation', 'live', 'remix', 'deluxe', 'remaster'],
      required: true
    },
    // Enhanced release dates
    dates: {
      release_date: {
        type: Date,
        required: true
      },
      original_release_date: Date,
      pre_save_date: Date,
      announcement_date: Date,
      recordingDate: Date,
      lastModified: Date
    },
    // Enhanced cover art system
    artwork: {
      cover_image: {
        high: String,
        medium: String,
        low: String,
        thumbnail: String
      },
      promotional_images: [{
        url: String,
        type: String, // banner, social, square, etc.
        dimensions: {
          width: Number,
          height: Number
        }
      }],
      colorPalette: [String] // Dominant colors for UI theming
    },
    // Enhanced metadata
    metadata: {
      genre: [{
        type: String,
        required: true
      }],
      subGenres: [String],
      moods: [String],
      themes: [String],
      era: String,
      language: String,
      totalTracks: Number,
      totalDiscs: Number,
      duration: Number,
      recordingType: String, // studio, live, acoustic, etc.
      studio: String
    },
    // Commercial information
    commercial: {
      label: String,
      distributors: [String],
      copyright: String,
      publishing: String,
      upc: String,
      price: {
        amount: Number,
        currency: String
      },
      preOrderAvailable: Boolean,
      exclusivity: {
        platform: String,
        until: Date
      }
    },
    // Enhanced availability settings
    availability: {
      regions: [String],
      restrictions: [{
        region: String,
        reason: String,
        startDate: Date,
        endDate: Date
      }],
      platforms: [{
        name: String,
        url: String,
        available: Boolean
      }]
    },
    // Enhanced analytics
    analytics: {
      totalStreams: { type: Number, default: 0 },
      uniqueListeners: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      presaves: { type: Number, default: 0 },
      shares: {
        total: { type: Number, default: 0 },
        platforms: {
          spotify: { type: Number, default: 0 },
          apple: { type: Number, default: 0 },
          facebook: { type: Number, default: 0 },
          instagram: { type: Number, default: 0 },
          twitter: { type: Number, default: 0 }
        }
      },
      playlists: {
        total: { type: Number, default: 0 },
        editorial: { type: Number, default: 0 },
        user: { type: Number, default: 0 }
      },
      performance: {
        peakPosition: Number,
        peakDate: Date,
        weeksOnChart: Number,
        certified: Boolean,
        certification: String // gold, platinum, etc.
      }
    },
    // Enhanced credits system
    credits: [{
      role: String,
      name: String,
      artistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'artists'
      },
      primary: Boolean,
      contribution: String
    }],
    // Release-specific description and notes
    description: {
      main: String,
      short: String,
      notes: String,
      highlights: [String],
      pressQuotes: [{
        quote: String,
        source: String,
        url: String,
        date: Date
      }]
    },
    // Enhanced tagging system
    tags: {
      user: [String],
      system: [String],
      genre: [String],
      mood: [String],
      occasion: [String]
    },
    // Content warnings and flags
    contentInfo: {
      isExplicit: Boolean,
      contentWarnings: [String],
      parentalAdvisory: Boolean,
      minimumAge: Number
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Indexes for efficient querying
releaseSchema.index({ title: "text" });
releaseSchema.index({ "metadata.genre": 1 });
releaseSchema.index({ "analytics.totalStreams": -1 });
releaseSchema.index({ "dates.release_date": -1 });

// Virtual for calculating release success score
releaseSchema.virtual('successScore').get(function() {
    return (
        (this.analytics.totalStreams * 1) +
        (this.analytics.saves * 2) +
        (this.analytics.shares.total * 3) +
        (this.analytics.playlists.total * 4)
    );
});
releaseSchema.index({ 'title': 'text', 'description.main': 'text' }); // Combined text search
releaseSchema.index({ 'artistId': 1, 'dates.release_date': -1 }); // For artist's releases by date
releaseSchema.index({ 'type': 1, 'dates.release_date': -1 }); // For release type filtering
releaseSchema.index({ 'metadata.genre': 1, 'dates.release_date': -1 }); // For genre filtering with date
releaseSchema.index({ 'commercial.label': 1 }); // For label filtering
releaseSchema.index({
  'analytics.totalStreams': -1,
  'analytics.saves': -1,
  'analytics.playlists.total': -1
}); // For popularity sortingç
releaseSchema.index({ title: 1 });
releaseSchema.index({ "metadata.genre": 1 });

const Release = mongoose.model("releases", releaseSchema);

module.exports = Release;
