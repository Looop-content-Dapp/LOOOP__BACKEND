import mongoose from 'mongoose';
import { Song } from '../models/song.model.js';
import 'dotenv/config';

// Free, playable music URLs (for testing only)
const sampleAudioUrls = [
  // SoundHelix Songs (Electronic/Instrumental)
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',

  // Additional Free Music Archive URLs
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Shipping_Lanes.mp3',
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Irsens_Tale/Kai_Engel_-_04_-_Moonlight_Reprise.mp3',
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Irsens_Tale/Kai_Engel_-_05_-_Great_Expectations.mp3',
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Irsens_Tale/Kai_Engel_-_06_-_Interception.mp3',
  'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Irsens_Tale/Kai_Engel_-_07_-_Anxiety.mp3',

];

const updateSongUrls = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const songs = await Song.find({});
    console.log(`Found ${songs.length} songs to update`);

    for (const song of songs) {
      // Randomly select an audio URL from the sample list
      const randomUrl = sampleAudioUrls[Math.floor(Math.random() * sampleAudioUrls.length)];

      // Update song with new audio URL and format
      await Song.findByIdAndUpdate(song._id, {
        $set: {
          fileUrl: randomUrl,
          format: 'mp3',
          bitrate: 320,
          duration: 180, // Default duration of 3 minutes
          flags: {
            ...song.flags,
            hasLyrics: false,
            isInstrumental: true
          }
        }
      });

      console.log(`Updated song: ${song._id}`);
    }

    console.log('Successfully updated all songs with sample audio URLs');
    process.exit(0);
  } catch (error) {
    console.error('Error updating song URLs:', error);
    process.exit(1);
  }
};

// Run the update script
updateSongUrls();
