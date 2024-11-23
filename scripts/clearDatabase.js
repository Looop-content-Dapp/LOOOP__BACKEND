const mongoose = require('mongoose');
require('dotenv').config();

const clearAllData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear artists
    const Artist = require('../models/artist.model');
    const artistCount = await Artist.countDocuments();
    await Artist.deleteMany({});
    console.log(`Cleared ${artistCount} artists`);

    // Clear releases
    const Release = require('../models/releases.model');
    const releaseCount = await Release.countDocuments();
    await Release.deleteMany({});
    console.log(`Cleared ${releaseCount} releases`);

    // Clear tracks
    const Track = require('../models/track.model');
    const trackCount = await Track.countDocuments();
    await Track.deleteMany({});
    console.log(`Cleared ${trackCount} tracks`);

    // Clear songs
    const Song = require('../models/song.model');
    const songCount = await Song.countDocuments();
    await Song.deleteMany({});
    console.log(`Cleared ${songCount} songs`);

    console.log('All data cleared successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  clearAllData();
}

module.exports = clearAllData;
