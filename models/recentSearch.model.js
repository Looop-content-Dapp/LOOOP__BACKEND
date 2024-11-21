const mongoose = require('mongoose');

const recentSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
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

module.exports = mongoose.model('RecentSearch', recentSearchSchema);
