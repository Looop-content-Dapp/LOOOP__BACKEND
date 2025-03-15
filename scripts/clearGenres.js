import mongoose from 'mongoose';
import { Genre } from '../models/genre.model.js';
import { config } from 'dotenv';
import { populateSpotifyGenres } from './PopulateSpotifyGenres.js';
import { fileURLToPath } from 'url';
import path from 'path';

// ES Module detection
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

// Loads .env
config();

const clearGenres = async () => {
  let connection = null;

  try {
    // Check if we're already connected
    if (mongoose.connection.readyState === 0) {
      console.log('Connecting to MongoDB...');
      connection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } else {
      console.log('Already connected to MongoDB');
    }

    // Clear existing genres
    const result = await Genre.deleteMany({});
    console.log(`Cleared ${result.deletedCount} genres from the database`);

    // Fetch new genres from Spotify
    console.log('Fetching genres from Spotify...');
    const genreDocs = await populateSpotifyGenres(false);

    if (!Array.isArray(genreDocs) || genreDocs.length === 0) {
      throw new Error('No genres returned from populateSpotifyGenres');
    }

    // Ensure all required fields are present (including image)
    const completeGenreDocs = genreDocs.map(doc => {
      // If no image is provided, add a placeholder
      if (!doc.image) {
        doc.image = `https://source.unsplash.com/random/300x300/?${encodeURIComponent(doc.name)}`;
      }
      return doc;
    });

    // Insert the genres into the database
    console.log(`Inserting ${completeGenreDocs.length} genres into the database...`);
    const insertedGenres = await Genre.insertMany(completeGenreDocs);
    console.log(`Successfully inserted ${insertedGenres.length} genres into the database`);

    // Close the connection only if we opened it in this function
    if (connection) {
      console.log('Closing database connection...');
      await mongoose.connection.close();
      console.log('Database connection closed');
    }

    return true;
  } catch (error) {
    console.error('Error in clearGenres:', error.message);

    // Close the connection on error if we opened it
    if (connection) {
      try {
        await mongoose.connection.close();
        console.log('Database connection closed after error');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }

    throw error;
  }
};

// Check if this module is being run directly (ES Modules approach)
if (isMainModule) {
  (async () => {
    try {
      await clearGenres();
      console.log('Script completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Script execution failed:', error);
      process.exit(1);
    }
  })();
}

export { clearGenres };
