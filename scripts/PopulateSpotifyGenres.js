import mongoose from "mongoose";
import { config } from "dotenv";
import { spotifyApi, getValidToken } from "../utils/spotify/spotifyClient";
import { Genre } from "../models/genre.model";

// Loads .env
config();

const SEED_GENRES = [
  'pop', 'hip-hop', 'rock', 'electronic', 'classical', 'jazz',
  'r-and-b', 'country', 'metal', 'indie', 'latin', 'k-pop',
  'reggae', 'blues', 'folk', 'soul', 'punk', 'ambient'
];

const getGenreDescription = (genre) => {
  const descriptions = {
    'pop': 'Contemporary popular music with broad mainstream appeal',
    'hip-hop': 'Urban music characterized by rhythmic vocals and beats',
    'rock': 'Guitar-driven music spanning multiple subgenres',
    'electronic': 'Computer-generated music including house, techno, and EDM',
    'classical': 'Traditional Western orchestral and chamber music',
    'jazz': 'Improvisational music rooted in blues and ragtime',
    'r-and-b': 'Rhythm and blues music with soul influences',
    'country': 'American folk music with rural roots',
    'metal': 'Heavy guitar-based music with intense vocals',
    'indie': 'Independent and alternative music across genres',
    'latin': 'Music from Latin America including reggaeton and salsa',
    'k-pop': 'South Korean popular music known for its stylized approach',
    'reggae': 'Jamaican music characterized by offbeat rhythms',
    'blues': 'African-American origin music based on the blues scale',
    'folk': 'Traditional and contemporary acoustic-based music',
    'soul': 'African-American music combining gospel and R&B elements',
    'punk': 'Fast-paced, aggressive rock music with DIY ethos',
    'ambient': 'Atmospheric electronic music emphasizing tone and texture'
  };
  return descriptions[genre] || `Music classified as ${genre}`;
};

const fetchSpotifyGenres = async () => {
  try {
    await getValidToken();
    let allGenres = new Set();

    // Add seed genres
    for (const genre of SEED_GENRES) {
      allGenres.add(genre);

      // Get top artist for each genre
      const result = await spotifyApi.searchArtists(`genre:${genre}`, { limit: 1 });
      if (result.body.artists.items.length > 0) {
        const artistId = result.body.artists.items[0].id;
        const related = await spotifyApi.getArtistRelatedArtists(artistId);

        // Add related artists' genres
        related.body.artists.forEach(artist => {
          artist.genres?.forEach(g => allGenres.add(g));
        });
      }

      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return Array.from(allGenres);
  } catch (error) {
    console.error('Error fetching Spotify genres:', error);
    return SEED_GENRES; // Fallback to seed genres if API fails
  }
};

export const populateSpotifyGenres = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Fetch genres from Spotify
    console.log('Fetching genres from Spotify...');
    const genres = await fetchSpotifyGenres();

    // Transform genres into documents
    const genreDocuments = genres.map(genre => ({
      name: genre.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      image: '/api/placeholder/300/200',
      description: getGenreDescription(genre)
    }));

    // Clear existing genres
    await Genre.deleteMany({});
    console.log('Cleared existing genres');

    // Insert new genres
    const result = await Genre.insertMany(genreDocuments);
    console.log(`Successfully populated ${result.length} genres`);

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error populating genres:', error);
    process.exit(1);
  }
};

// Check if this module is being run directly
if (import.meta.url === new URL(import.meta.resolve('./scripts/PopulateSpotifyGenres.js'))) {
  populateSpotifyGenres();
}

// module.exports = { populateSpotifyGenres };
