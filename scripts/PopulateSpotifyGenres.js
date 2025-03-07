import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import { Genre } from '../models/genre.model.js';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ES Module detection
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

// Predefined fallback genres - this will be our primary source now
const SEED_GENRES = [
  'pop', 'rock', 'hip-hop', 'jazz', 'classical', 'country', 'electronic',
  'dance', 'rap', 'reggae', 'blues', 'folk', 'metal', 'punk', 'r-n-b',
  'indie', 'alternative', 'soul', 'ambient', 'funk', 'disco', 'house',
  'techno', 'trance', 'drum-and-bass', 'edm', 'lo-fi',
  // Add more genres here for better coverage
  'afrobeat', 'bluegrass', 'children', 'chill', 'club',
  'comedy', 'deep-house', 'detroit-techno', 'disney',
  'drum-and-bass', 'dub', 'dubstep', 'edm', 'electro',
  'electronic', 'emo', 'folk', 'french', 'funk',
  'garage', 'german', 'gospel', 'goth', 'grindcore',
  'groove', 'grunge', 'guitar', 'happy', 'hard-rock',
  'hardcore', 'hardstyle', 'heavy-metal', 'hip-hop',
  'holidays', 'honky-tonk', 'house', 'idm', 'indian',
  'indie', 'indie-pop', 'industrial', 'iranian', 'j-dance',
  'j-idol', 'j-pop', 'j-rock', 'jazz', 'k-pop',
  'kids', 'latin', 'latino', 'malay', 'mandopop',
  'metal', 'metal-misc', 'metalcore', 'minimal-techno',
  'movies', 'mpb', 'new-age', 'new-release', 'opera',
  'pagode', 'party', 'philippines-opm', 'piano', 'pop',
  'pop-film', 'post-dubstep', 'power-pop', 'progressive-house',
  'psych-rock', 'punk', 'punk-rock', 'r-n-b', 'rainy-day',
  'reggae', 'reggaeton', 'road-trip', 'rock', 'rock-n-roll',
  'rockabilly', 'romance', 'sad', 'salsa', 'samba',
  'sertanejo', 'show-tunes', 'singer-songwriter', 'ska',
  'sleep', 'songwriter', 'soul', 'soundtracks', 'spanish',
  'study', 'summer', 'swedish', 'synth-pop', 'tango',
  'techno', 'trance', 'trip-hop', 'turkish', 'work-out',
  'world-music'
];

// Initialize Spotify API client with proper error handling
let spotifyApi;
try {
  spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('Missing Spotify API credentials in environment variables');
    if (isMainModule) process.exit(1);
  }
} catch (error) {
  console.error('Failed to initialize Spotify API client:', error);
  if (isMainModule) process.exit(1);
}

/**
 * Retries a Spotify API call if it hits a rate limit (429 error).
 * @param {Function} apiCall - The API call to retry.
 * @param {number} [maxRetries=3] - Maximum number of retries.
 * @param {number} [baseDelay=1] - Base delay in seconds.
 * @returns {Promise} - The result of the API call.
 */
const retryOnRateLimit = async (apiCall, maxRetries = 3, baseDelay = 1) => {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      if (error.statusCode === 429) {
        const retryAfter = error.headers?.['retry-after'] ?
          parseInt(error.headers['retry-after'], 10) : baseDelay * Math.pow(2, retries);

        console.log(`Rate limit hit, retrying after ${retryAfter} seconds... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
      } else if (error.statusCode === 401) {
        // Token expired, get a new one and retry
        console.log('Access token expired, refreshing...');
        await getValidToken();
        retries++;
      } else {
        // For other errors, we'll retry once
        if (retries === 0) {
          console.warn(`API error (${error.statusCode}), retrying once...`);
          await new Promise(resolve => setTimeout(resolve, baseDelay * 1000));
          retries++;
        } else {
          throw error;
        }
      }
    }
  }

  console.error(`Max retries (${maxRetries}) reached:`, lastError?.message || 'Unknown error');
  throw lastError || new Error('Max retries reached');
};

/**
 * Obtains a valid access token for Spotify API calls.
 * @returns {Promise<string>} - The access token.
 */
const getValidToken = async () => {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    const accessToken = data.body['access_token'];
    spotifyApi.setAccessToken(accessToken);
    console.log('Successfully obtained new Spotify access token');
    return accessToken;
  } catch (error) {
    console.error(`Failed to obtain Spotify token:`, error?.message || error);
    throw new Error(`Failed to obtain Spotify token: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Normalizes genre names for consistency
 * @param {string} genre - The genre name to normalize
 * @returns {string} - Normalized genre name
 */
const normalizeGenre = (genre) => {
  if (!genre || typeof genre !== 'string') return '';

  // Convert to lowercase and trim
  return genre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/[^\w-]/g, '')   // Remove special characters except hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with a single one
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
};

/**
 * Fetches available genre seeds from Spotify
 * @returns {Promise<string[]>} - Array of genre seeds
 */
const fetchAvailableGenreSeeds = async () => {
  try {
    // We can't use getGeneric as it doesn't exist in this version of the library
    // Use a direct request to the recommendations/available-genre-seeds endpoint
    const data = await retryOnRateLimit(() =>
      spotifyApi.getAvailableGenreSeeds()
    );

    if (data.body && data.body.genres && Array.isArray(data.body.genres)) {
      return data.body.genres;
    }
  } catch (error) {
    console.warn('Error fetching genre seeds:', error.message);
  }

  return [];
};

/**
 * Fetches artists related to a genre with proper error handling
 * @param {string} genre - The genre to search for
 * @param {number} limit - Maximum number of artists to fetch
 * @returns {Promise<Array>} - Array of artists
 */
const fetchArtistsByGenre = async (genre, limit = 3) => {
  try {
    const result = await retryOnRateLimit(() =>
      spotifyApi.searchArtists(`genre:${genre}`, { limit, market: 'US' })
    );

    return result.body.artists?.items || [];
  } catch (error) {
    console.warn(`Error fetching artists for genre ${genre}:`, error.message);
    return [];
  }
};

/**
 * Fetches genres from an artist
 * @param {Object} artist - The artist object
 * @returns {Set<string>} - Set of unique normalized genres
 */
const getArtistGenres = (artist) => {
  const genres = new Set();

  if (artist && artist.genres && Array.isArray(artist.genres)) {
    artist.genres.forEach(genre => {
      const normalizedGenre = normalizeGenre(genre);
      if (normalizedGenre) genres.add(normalizedGenre);
    });
  }

  return genres;
};

/**
 * Fetches genres from Spotify, using primarily the predefined list and enhancing with
 * artist genres where possible.
 * @returns {Promise<string[]>} - Array of unique genres.
 */
const fetchSpotifyGenres = async () => {
  try {
    // Initialize with predefined genres (as our primary source)
    const allGenres = new Set(SEED_GENRES.map(normalizeGenre).filter(Boolean));
    console.log(`Starting with ${allGenres.size} predefined genres`);

    // First obtain a valid token
    await getValidToken();

    // Try to get available genre seeds to enhance our list
    try {
      const genreSeeds = await fetchAvailableGenreSeeds();
      if (genreSeeds.length > 0) {
        console.log(`Retrieved ${genreSeeds.length} genre seeds from Spotify`);
        genreSeeds.forEach(genre => {
          const normalizedGenre = normalizeGenre(genre);
          if (normalizedGenre) allGenres.add(normalizedGenre);
        });
      }
    } catch (error) {
      console.warn('Could not fetch available genre seeds:', error.message);
    }

    console.log(`Current genre count: ${allGenres.size}`);

    // Process a subset of genres to find more related genres
    // Use a random sample to get better coverage
    const allGenresArray = Array.from(allGenres);
    const sampleSize = Math.min(10, allGenresArray.length);
    const sampleGenres = [];

    // Get random sample without duplicates
    const usedIndices = new Set();
    while (sampleGenres.length < sampleSize) {
      const randomIndex = Math.floor(Math.random() * allGenresArray.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        sampleGenres.push(allGenresArray[randomIndex]);
      }
    }

    console.log(`Processing ${sampleGenres.length} sample genres to find artist genres...`);

    // Process each sample genre
    for (const [index, genre] of sampleGenres.entries()) {
      console.log(`\nProcessing sample genre ${index + 1}/${sampleGenres.length}: ${genre}`);

      // Fetch artists for this genre
      const artists = await fetchArtistsByGenre(genre);

      if (artists.length === 0) {
        console.log(`No artists found for genre: ${genre}`);
        continue;
      }

      console.log(`Found ${artists.length} artists for genre: ${genre}`);

      // Process each artist to get their genres
      for (const artist of artists) {
        // Add the artist's genres
        const artistGenres = getArtistGenres(artist);
        artistGenres.forEach(g => allGenres.add(g));
      }

      // Add a short delay before processing the next genre
      if (index < sampleGenres.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Convert set to array, filter empty values and sort alphabetically
    return Array.from(allGenres).filter(Boolean).sort();
  } catch (error) {
    console.error('Error in fetchSpotifyGenres:', error?.message || error);
    // Return fallback genres if everything fails
    return SEED_GENRES.map(normalizeGenre).filter(Boolean);
  }
};

/**
 * Populates the database with genres fetched from Spotify.
 * @param {boolean} [dryRun=false] - If true, will not update the database
 * @returns {Promise<Array>} - The list of genres
 */
const populateSpotifyGenres = async (dryRun = false) => {
  try {
    console.log('Starting Spotify genre population process...');

    // Fetch genres from Spotify
    const genres = await fetchSpotifyGenres();
    console.log(`\nTotal unique genres collected: ${genres.length}`);

    if (dryRun) {
      console.log('Dry run mode enabled - not updating database');
      return genres.map(name => ({ name }));
    }

    // Create genre documents with name, image, and timestamps
    const genreDocs = genres.map(name => ({
      name,
      image: `https://source.unsplash.com/random/300x300/?${encodeURIComponent(name)}`, // Default placeholder image
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    return genreDocs;
  } catch (error) {
    console.error('Error populating genres:', error?.message || error);
    throw error;
  }
};

// Only execute if this module is run directly (ES Module version)
if (isMainModule) {
  (async () => {
    try {
      // Parse command line arguments
      const dryRun = process.argv.includes('--dry-run');

      console.log(`Starting Spotify genre population script${dryRun ? ' (DRY RUN)' : ''}...`);
      const startTime = Date.now();

      const genres = await populateSpotifyGenres(dryRun);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\nCompleted in ${duration} seconds.`);
      console.log(`Total genres: ${genres.length}`);

      if (process.argv.includes('--print')) {
        console.log('\nGenres retrieved:');
        console.log(genres.map(g => g.name).join(', '));
      }

      process.exit(0);
    } catch (error) {
      console.error('Script failed:', error);
      process.exit(1);
    }
  })();
}

// Export for testing or importing as a module
export {
  fetchSpotifyGenres,
  populateSpotifyGenres,
  normalizeGenre,
  getValidToken,
  retryOnRateLimit
};
