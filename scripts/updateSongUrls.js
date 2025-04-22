import mongoose from 'mongoose';
import { Song } from '../models/song.model.js';
import 'dotenv/config';

// Free, playable music URLs (for testing only)
const sampleAudioUrls = [
  // SoundHelix Songs (Electronic/Instrumental)
  'https://cdn.trendybeatz.com/audio/Zlatan-Ft-Fola-Get-Better-1-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Blaqbonez-Ft-Young-Jonn-and-Phyno-W-For-Wetego-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Teni-Money-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Shallipopi-Laho-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Shoday-Ft-Olivetheboy-Screaming-Beauty-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/TI-Blaze-Ft-AratheJay-Mario-Remix-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/TI-Blaze-Jericho-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/TI-Blaze-My-Brother-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Solidstar-Hold-Me-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Solidstar-Shut-Down-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Solidstar-Mikasa-Sukasa-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Davido-Be-There-Still-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Davido-So-Crazy-ft-Lil-Baby-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Davido-Something-Fishy-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Davido-For-The-Road-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/OdumoduBlvck-Ft-Victony-Pity-This-Boy-(TrendyBeatz.com).mp3',

  // Additional Free Music Archive URLs
  'https://cdn.trendybeatz.com/audio/Ruger-Jay-Jay-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Ayra-Starr-All-The-Love-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Rema-Smooth-Criminal-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Rema-DND-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Rema-Baby-Is-It-A-Crime-(TrendyBeatz.com).mp3',
  'https://cdn.trendybeatz.com/audio/Olamide-Ft-Asake-New-Religion-(TrendyBeatz.com).mp3',
  "https://cdn.trendybeatz.com/audio/Olamide-Ft-Rema-Mukulu-(TrendyBeatz.com).mp3",
  "https://cdn.trendybeatz.com/audio/Olamide-No-Worries-(TrendyBeatz.com).mp3",
  "https://cdn.trendybeatz.com/audio/Blaqbonez-Like-Ice-Spice-(TrendyBeatz.com).mp3",
  "https://cdn.trendybeatz.com/audio/Davido-Ft-Odumodublvck-and-Chike-Funds-(TrendyBeatz.com).mp3"

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
