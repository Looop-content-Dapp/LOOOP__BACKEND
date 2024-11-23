// utils/generateStreamHistory.js

const mongoose = require('mongoose');
const Song = require('../models/song.model');
require('dotenv').config();

const countries = ['US', 'GB', 'NG', 'GH', 'ZA', 'KE', 'CA', 'FR', 'DE', 'JP'];
const devices = ['iPhone', 'Android', 'Desktop', 'Tablet', 'Web'];
const qualities = ['high', 'standard', 'low'];

const generateRandomStreamHistory = (days = 30, minStreamsPerDay = 10, maxStreamsPerDay = 100) => {
  const streamHistory = [];
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const streamsToday = Math.floor(Math.random() * (maxStreamsPerDay - minStreamsPerDay + 1)) + minStreamsPerDay;

    for (let i = 0; i < streamsToday; i++) {
      streamHistory.push({
        userId: new mongoose.Types.ObjectId(), // Random user ID
        timestamp: new Date(d),
        deviceType: devices[Math.floor(Math.random() * devices.length)],
        quality: qualities[Math.floor(Math.random() * qualities.length)],
        region: countries[Math.floor(Math.random() * countries.length)],
        completionRate: Math.random() * 100,
        offline: Math.random() > 0.8
      });
    }
  }

  return streamHistory;
};

const populateStreamHistory = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const songs = await Song.find({});
    console.log(`Found ${songs.length} songs to update`);

    for (const song of songs) {
      const streamHistory = generateRandomStreamHistory();
      await Song.findByIdAndUpdate(song._id, {
        $set: { streamHistory }
      });
      console.log(`Updated stream history for song: ${song._id}`);
    }

    console.log('Stream history population completed');
    process.exit(0);
  } catch (error) {
    console.error('Error populating stream history:', error);
    process.exit(1);
  }
};

module.exports = {
  generateRandomStreamHistory,
  populateStreamHistory
};
