import mongoose from 'mongoose';
import { spotifyApi, getValidToken } from '../utils/spotify/spotifyClient.js';
import { Artist } from '../models/artist.model.js';
import { Release } from '../models/releases.model.js';
import { Track } from '../models/track.model.js';
import { Song } from '../models/song.model.js';
import { Genre } from '../models/genre.model.js';
import { config } from 'dotenv';
import crypto from 'crypto';

// Load environment variables
config();

// Initial base genre categories
const genreCategories = [
  { name: 'Afrobeats', image: '/api/placeholder/300/200', description: 'Contemporary African popular music blending West African musical styles' },
  { name: 'Country', image: '/api/placeholder/300/200', description: 'American folk music with rural roots' },
  { name: 'Rock', image: '/api/placeholder/300/200', description: 'Guitar-driven music spanning from classic to alternative rock' },
  { name: 'Pop', image: '/api/placeholder/300/200', description: 'Mainstream contemporary popular music' },
  { name: 'Hip Hop', image: '/api/placeholder/300/200', description: 'Urban music characterized by rhythmic vocals and beats' },
  { name: 'Metal', image: '/api/placeholder/300/200', description: 'Heavy guitar-based music with intense vocals' },
  { name: 'Indie', image: '/api/placeholder/300/200', description: 'Independent and alternative music across genres' },
  { name: 'K-Pop', image: '/api/placeholder/300/200', description: 'South Korean popular music known for its stylized approach' },
  { name: 'Latin', image: '/api/placeholder/300/200', description: 'Music from Latin America including reggaeton, salsa, and bachata' },
  { name: 'Electronic', image: '/api/placeholder/300/200', description: 'Computer-generated music including house, techno, and EDM' }
];

// Track processed items to avoid duplicates
const processedCache = {
  artists: new Set(),
  releases: new Set(),
  tracks: new Set(),
  genres: new Set()
};

/**
 * Create a consistent ObjectId from a string
 * @param {string} str - Input string for hashing
 * @returns {mongoose.Types.ObjectId} MongoDB ObjectId
 */
const createObjectId = (str) => {
  // Create a deterministic hash from the input string
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 24);
  return new mongoose.Types.ObjectId(hash);
};

/**
 * Get or create genres and return their ObjectIds
 * @param {Array<string>} genreNames - Array of genre names
 * @returns {Promise<Array>} Array of genre ObjectIds
 */
const getGenreIds = async (genreNames = []) => {
  if (!genreNames.length) return [];

  const genreIds = [];

  for (const genreName of genreNames) {
    try {
      const normalizedName = genreName.toLowerCase();

      // Check cache first
      if (processedCache.genres.has(normalizedName)) {
        const existingGenre = await Genre.findOne({
          name: { $regex: new RegExp(`^${genreName}$`, 'i') }
        });

        if (existingGenre) {
          genreIds.push(existingGenre._id);
          continue;
        }
      }

      // Create or update genre
      const genre = await Genre.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${genreName}$`, 'i') } },
        {
          name: genreName,
          image: '/api/placeholder/300/200',
          description: `Music categorized as ${genreName}`
        },
        { upsert: true, new: true }
      );

      genreIds.push(genre._id);
      processedCache.genres.add(normalizedName);
    } catch (error) {
      console.warn(`Could not process genre "${genreName}":`, error.message);
    }
  }

  return genreIds;
};

/**
 * Transform Spotify artist data to our database format
 * @param {Object} spotifyArtist - Artist data from Spotify API
 * @returns {Promise<Object>} Transformed artist data
 */
const transformArtist = async (spotifyArtist) => {
  // Check for existing artist
  if (processedCache.artists.has(spotifyArtist.id)) {
    const existingArtist = await Artist.findOne({ artistId: spotifyArtist.id });
    if (existingArtist) return existingArtist;
  }

  // Generate a deterministic userId
  const userId = createObjectId(spotifyArtist.id);
  console.log(`Generated userId ${userId} for artist ${spotifyArtist.name}`);

  // Generate artist biography
  let biography = '';
  try {
    const artistInfo = await spotifyApi.getArtist(spotifyArtist.id);
    biography = artistInfo.body.biography ||
      `${spotifyArtist.name} is an artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`;

    if (spotifyArtist.genres?.length) {
      biography += ` Their music can be described as ${spotifyArtist.genres.join(', ')}.`;
    }
  } catch (error) {
    biography = `${spotifyArtist.name} is an artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`;
    console.warn(`Could not fetch bio for ${spotifyArtist.name}:`, error.message);
  }

  // Get genre IDs
  const genreIds = await getGenreIds(spotifyArtist.genres || []);

  // Mark artist as processed
  processedCache.artists.add(spotifyArtist.id);

  // Timestamp for unique email
  const timestamp = Date.now();

  return {
    name: spotifyArtist.name,
    artistId: spotifyArtist.id,
    email: `artist_${spotifyArtist.id}_${timestamp}@placeholder.com`,
    password: `spotify_${spotifyArtist.id}`,
    profileImage: spotifyArtist.images?.[0]?.url || '/api/placeholder/300/300',
    biography,
    address1: "123 Music Avenue",
    address2: "Suite 101",
    country: spotifyArtist.country || "US",
    postalcode: "10001",
    city: "New York",
    websiteurl: spotifyArtist.external_urls?.spotify || null,
    monthlyListeners: Math.floor(Math.random() * 1000000) + 1000,
    followers: spotifyArtist.followers?.total || 0,
    verified: true,
    socialLinks: {
      spotify: spotifyArtist.external_urls?.spotify || null,
      instagram: null,
      twitter: null,
      facebook: null,
      website: null
    },
    popularity: spotifyArtist.popularity || 0,
    topTracks: [],
    roles: ['musician'],
    labels: [],
    isActive: true,
    userId: userId,
    genres: genreIds,
  };
};

/**
 * Transform Spotify album to our release format
 * @param {Object} spotifyAlbum - Album data from Spotify API
 * @param {string} artistId - MongoDB ID of the artist
 * @returns {Object|null} Transformed release data or null if already processed
 */
const transformRelease = (spotifyAlbum, artistId) => {
  // Create unique key for this release
  const releaseKey = `${artistId}_${spotifyAlbum.id}`;

  // Skip if already processed
  if (processedCache.releases.has(releaseKey)) {
    console.log(`Release ${spotifyAlbum.name} already processed, skipping`);
    return null;
  }

  // Parse release date
  const releaseDate = new Date(spotifyAlbum.release_date || new Date().toISOString().split('T')[0]);

  // Mark as processed
  processedCache.releases.add(releaseKey);

  return {
    title: spotifyAlbum.name,
    artistId,
    type: spotifyAlbum.album_type,
    spotifyId: spotifyAlbum.id,
    dates: {
      release_date: releaseDate,
      original_release_date: releaseDate,
      lastModified: new Date()
    },
    artwork: {
      cover_image: {
        high: spotifyAlbum.images?.[0]?.url || '/api/placeholder/300/300',
        medium: spotifyAlbum.images?.[1]?.url || '/api/placeholder/200/200',
        low: spotifyAlbum.images?.[2]?.url || '/api/placeholder/100/100',
        thumbnail: spotifyAlbum.images?.[2]?.url || '/api/placeholder/64/64'
      },
      promotional_images: [],
      colorPalette: []
    },
    metadata: {
      genre: spotifyAlbum.genres?.length ? [spotifyAlbum.genres[0]] : ['unknown'],
      subGenres: (spotifyAlbum.genres || []).slice(1),
      totalTracks: spotifyAlbum.total_tracks || 0,
      duration: spotifyAlbum.tracks?.items?.reduce((acc, track) => acc + (track.duration_ms || 0), 0) || 0,
      recordingType: 'studio',
      language: 'en'
    },
    commercial: {
      label: spotifyAlbum.label || 'Independent',
      upc: spotifyAlbum.external_ids?.upc || `TEMP-UPC-${Date.now()}`
    },
    availability: {
      platforms: [{
        name: 'Spotify',
        url: spotifyAlbum.external_urls?.spotify || null,
        available: true
      }]
    },
    analytics: generateAnalytics(),
    credits: [{
      role: 'Primary Artist',
      artistId,
      primary: true,
      contribution: 'Performance'
    }],
    description: {
      main: `${spotifyAlbum.name} - ${spotifyAlbum.album_type} by ${spotifyAlbum.artists?.[0]?.name || 'Unknown Artist'}`,
      short: spotifyAlbum.name
    },
    contentInfo: {
      isExplicit: spotifyAlbum.tracks?.items?.some(track => track.explicit) || false,
      parentalAdvisory: spotifyAlbum.tracks?.items?.some(track => track.explicit) || false
    }
  };
};

/**
 * Transform Spotify track to our format
 * @param {Object} spotifyTrack - Track data from Spotify API
 * @param {string} artistId - MongoDB ID of the artist
 * @param {string} releaseId - MongoDB ID of the release
 * @param {string} releaseType - Type of release (album, single, ep)
 * @returns {Object|null} Transformed track data or null if already processed
 */
const transformTrack = (spotifyTrack, artistId, releaseId, releaseType) => {
  // Create unique key for this track
  const trackKey = `${releaseId}_${spotifyTrack.id}`;

  // Skip if already processed
  if (processedCache.tracks.has(trackKey)) {
    console.log(`Track ${spotifyTrack.name} already processed, skipping`);
    return null;
  }

  // Calculate release year
  const releaseYear = spotifyTrack.album?.release_date
    ? new Date(spotifyTrack.album.release_date).getFullYear()
    : new Date().getFullYear();

  // Arrays for random selection
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const moods = ['Energetic', 'Calm', 'Melancholic', 'Happy', 'Aggressive', 'Romantic', 'Nostalgic'];

  // Mark as processed
  processedCache.tracks.add(trackKey);

  return {
    releaseId,
    songId: null, // Set later after song creation
    title: spotifyTrack.name,
    spotifyId: spotifyTrack.id,
    version: 'Original',
    duration: spotifyTrack.duration_ms || 0,
    track_number: spotifyTrack.track_number || 1,
    disc_number: spotifyTrack.disc_number || 1,
    artistId,
    metadata: {
      genre: spotifyTrack.genres?.[0] ? [spotifyTrack.genres[0]] : ['unknown'],
      bpm: Math.floor(Math.random() * 100) + 70,
      key: keys[Math.floor(Math.random() * keys.length)],
      mood: moods[Math.floor(Math.random() * moods.length)],
      tags: [],
      isrc: spotifyTrack.external_ids?.isrc || `TEMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
      languageCode: 'en',
      recordingYear: releaseYear,
      recordingLocation: 'Studio'
    },
    credits: [{
      role: 'Primary Artist',
      artistId,
      contribution: 'Performance',
      primaryContributor: true
    }],
    lyrics: {
      syncedLyrics: [],
      plainText: null,
      language: 'en',
      hasTranslation: false,
      translations: []
    },
    interactions: {
      skipCount: Math.floor(Math.random() * 10000),
      completionRate: (Math.random() * 0.3) + 0.7,
      averageListenTime: Math.floor(Math.random() * (spotifyTrack.duration_ms || 180000)),
      playlists: Math.floor(Math.random() * 5000),
      likes: Math.floor(Math.random() * 50000),
      shares: Math.floor(Math.random() * 10000)
    },
    regionalData: [
      {
        region: 'US',
        streams: Math.floor(Math.random() * 5000000),
        shares: Math.floor(Math.random() * 50000),
        playlists: Math.floor(Math.random() * 10000),
        skipRate: Math.random() * 0.3
      },
      {
        region: 'UK',
        streams: Math.floor(Math.random() * 2000000),
        shares: Math.floor(Math.random() * 20000),
        playlists: Math.floor(Math.random() * 5000),
        skipRate: Math.random() * 0.3
      },
      {
        region: 'DE',
        streams: Math.floor(Math.random() * 1500000),
        shares: Math.floor(Math.random() * 15000),
        playlists: Math.floor(Math.random() * 3000),
        skipRate: Math.random() * 0.3
      }
    ],
    flags: {
      isExplicit: spotifyTrack.explicit || false,
      isInstrumental: spotifyTrack.name.toLowerCase().includes('instrumental'),
      isLive: spotifyTrack.name.toLowerCase().includes('live'),
      isAcoustic: spotifyTrack.name.toLowerCase().includes('acoustic'),
      isRemix: spotifyTrack.name.toLowerCase().includes('remix'),
      hasLyrics: !spotifyTrack.name.toLowerCase().includes('instrumental')
    }
  };
};

/**
 * Transform Spotify track to our song format
 * @param {Object} spotifyTrack - Track data from Spotify API
 * @returns {Object} Transformed song data
 */
const transformSong = (spotifyTrack) => {
  // Generate waveform data
  const waveformPoints = 100;
  const waveform = Array.from({ length: waveformPoints }, () => Math.random());

  // Generate random stats
  const stats = generateRandomStats();

  return {
    fileUrl: spotifyTrack.preview_url || 'placeholder_url',
    spotifyId: spotifyTrack.id,
    duration: spotifyTrack.duration_ms || 0,
    bitrate: 320,
    format: 'mp3',
    analytics: {
      totalStreams: stats.totalStreams,
      uniqueListeners: stats.uniqueListeners,
      playlistAdditions: stats.playlistAdditions,
      shares: stats.shares,
      likes: stats.likes,
      comments: Math.floor(Math.random() * 1000),
      downloads: Math.floor(Math.random() * 50000)
    },
    streamHistory: generateStreamHistory(),
    engagement: {
      skipRate: Math.random() * 0.3,
      averageCompletionRate: Math.random() * 0.3 + 0.7,
      repeatListenRate: Math.random() * 0.5,
      peakListeningTimes: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: Math.floor(Math.random() * 10000)
      }))
    },
    playlists: [],
    waveform: waveform,
    lyrics: "",
    isrc: spotifyTrack.external_ids?.isrc || `TEMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
    audioQuality: {
      peak: Math.random(),
      averageVolume: Math.random() * 0.8,
      dynamicRange: Math.random() * 20
    },
    flags: {
      isExplicit: spotifyTrack.explicit || false,
      containsExplicitLanguage: spotifyTrack.explicit || false,
      isInstrumental: spotifyTrack.name.toLowerCase().includes('instrumental'),
      hasLyrics: !spotifyTrack.name.toLowerCase().includes('instrumental')
    }
  };
};

/**
 * Generate random analytics data
 * @returns {Object} Analytics data
 */
const generateAnalytics = () => ({
  totalStreams: Math.floor(Math.random() * 5000000),
  uniqueListeners: Math.floor(Math.random() * 1000000),
  saves: Math.floor(Math.random() * 100000),
  presaves: Math.floor(Math.random() * 10000),
  shares: {
    total: Math.floor(Math.random() * 50000),
    platforms: {
      spotify: Math.floor(Math.random() * 20000),
      apple: Math.floor(Math.random() * 10000),
      facebook: Math.floor(Math.random() * 5000),
      instagram: Math.floor(Math.random() * 5000),
      twitter: Math.floor(Math.random() * 5000)
    }
  },
  playlists: {
    total: Math.floor(Math.random() * 5000),
    editorial: Math.floor(Math.random() * 500),
    user: Math.floor(Math.random() * 4500)
  }
});

/**
 * Generate random stream history
 * @returns {Array} Stream history data for past 30 days
 */
const generateStreamHistory = () => {
  const streamHistory = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    streamHistory.push({
      date: date,
      streams: Math.floor(Math.random() * 10000),
      uniqueListeners: Math.floor(Math.random() * 5000)
    });
  }

  return streamHistory;
};

/**
 * Generate random statistics for songs
 * @returns {Object} Random statistics
 */
const generateRandomStats = () => ({
  totalStreams: Math.floor(Math.random() * 10000000),
  uniqueListeners: Math.floor(Math.random() * 5000000),
  playlistAdditions: Math.floor(Math.random() * 100000),
  shares: {
    total: Math.floor(Math.random() * 50000),
    platforms: {
      facebook: Math.floor(Math.random() * 20000),
      twitter: Math.floor(Math.random() * 15000),
      whatsapp: Math.floor(Math.random() * 10000),
      other: Math.floor(Math.random() * 5000)
    }
  },
  likes: Math.floor(Math.random() * 500000)
});

/**
 * Import genres into database
 */
const importGenres = async () => {
  console.log('Importing base genres...');

  for (const genre of genreCategories) {
    try {
      const existingGenre = await Genre.findOne({
        name: { $regex: new RegExp(`^${genre.name}$`, 'i') }
      });

      if (existingGenre) {
        console.log(`Genre ${genre.name} already exists, skipping`);
        processedCache.genres.add(genre.name.toLowerCase());
        continue;
      }

      await Genre.create(genre);
      console.log(`Imported genre: ${genre.name}`);
      processedCache.genres.add(genre.name.toLowerCase());
    } catch (error) {
      console.error(`Error importing genre ${genre.name}:`, error.message);
    }
  }

  console.log('Genre import completed');
};

/**
 * Check if entity exists in database
 * @param {string} spotifyId - Spotify ID of the entity
 * @param {Function} model - Mongoose model to check
 * @param {Object} additionalQuery - Additional query parameters
 * @returns {Promise<Object|null>} Entity document or null
 */
const checkExists = async (spotifyId, model, additionalQuery = {}) => {
  try {
    return await model.findOne({
      spotifyId,
      ...additionalQuery
    });
  } catch (error) {
    console.error(`Error checking existence: ${error.message}`);
    return null;
  }
};

/**
 * Import all releases for an artist
 * @param {string} artistId - MongoDB ID of the artist
 * @param {string} spotifyArtistId - Spotify ID of the artist
 */
const importArtistReleases = async (artistId, spotifyArtistId) => {
  try {
    await getValidToken();
    console.log(`Fetching releases for artist ID: ${spotifyArtistId}`);

    // Get albums, singles, and EPs
    const albums = await spotifyApi.getArtistAlbums(spotifyArtistId, {
      limit: 5,
      include_groups: 'album,single,ep'
    });

    console.log(`Found ${albums.body.items.length} potential releases`);

    // Process each album
    for (const album of albums.body.items) {
      try {
        await getValidToken();

        // Check for existing release
        const existingRelease = await checkExists(album.id, Release, { artistId });
        if (existingRelease) {
          console.log(`Release ${album.name} already exists, skipping`);
          processedCache.releases.add(`${artistId}_${album.id}`);
          continue;
        }

        console.log(`Processing release: ${album.name} (${album.album_type})`);

        // Transform and save release
        const releaseData = transformRelease(album, artistId);
        if (!releaseData) continue;

        const release = await Release.create(releaseData);

        // Get tracks for this album
        const tracksResponse = await spotifyApi.getAlbumTracks(album.id, { limit: 7 });
        const tracks = tracksResponse.body.items;
        console.log(`Found ${tracks.length} tracks for ${album.name}`);

        // Process each track
        for (const track of tracks) {
          try {
            // Check for existing track
            const existingTrack = await checkExists(track.id, Track, { releaseId: release._id });
            if (existingTrack) {
              console.log(`Track ${track.name} already exists, skipping`);
              processedCache.tracks.add(`${release._id}_${track.id}`);
              continue;
            }

            // Check for existing song
            const existingSong = await checkExists(track.id, Song);
            let song;

            if (existingSong) {
              console.log(`Song for track ${track.name} already exists, using existing`);
              song = existingSong;
            } else {
              // Create new song
              const songData = transformSong(track);
              song = await Song.create(songData);
            }

            // Transform and save track
            const trackData = transformTrack(track, artistId, release._id, release.type);
            if (!trackData) continue;

            trackData.songId = song._id;
            await Track.create(trackData);
          } catch (trackError) {
            console.error(`Error importing track ${track.name}:`, trackError.message);
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        if (error.body?.error?.message === 'The access token expired') {
          await getValidToken();
          console.log('Token refreshed. Retrying...');
          continue;
        }
        console.error(`Error importing release ${album.name}:`, error.message);
      }
    }

    console.log(`Completed importing releases for artist: ${spotifyArtistId}`);
  } catch (error) {
    if (error.body?.error?.message === 'The access token expired') {
      await getValidToken();
      console.log('Token refreshed. Retrying import...');
      return importArtistReleases(artistId, spotifyArtistId);
    }
    console.error(`Failed to import releases for artist ${spotifyArtistId}:`, error.message);
    throw error;
  }
};

/**
 * Main function to import Spotify data
 */
const importSpotifyData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get initial token
    await getValidToken();

    // Import genres
    await importGenres();

    // Limit artists per genre
    const maxArtistsPerGenre = 4;

    // Process each genre
    for (const genre of genreCategories) {
      try {
        console.log(`\n=== Importing ${genre.name} artists ===`);
        await getValidToken();

        // Search for artists in this genre
        const artistsResponse = await spotifyApi.searchArtists(`genre:${genre.name.toLowerCase()}`, { limit: 5 });
        const artists = artistsResponse.body.artists.items;
        console.log(`Found ${artists.length} ${genre.name} artists`);

        // Process limited number of artists
        let processedCount = 0;
        for (const artist of artists) {
          if (processedCount >= maxArtistsPerGenre) {
            console.log(`Reached limit of ${maxArtistsPerGenre} artists for ${genre.name}`);
            break;
          }

          try {
            // Check for existing artist
            const existingArtist = await checkExists(artist.id, Artist);
            let savedArtist;

            if (existingArtist) {
              console.log(`Artist ${artist.name} already exists, using existing record`);
              savedArtist = existingArtist;
              processedCache.artists.add(artist.id);
            } else {
              console.log(`Importing artist: ${artist.name}`);

              // Transform artist data
              const artistData = await transformArtist(artist);

              // Ensure userId is present
              if (!artistData.userId) {
                console.error(`Error: userId is null for artist ${artist.name}. Skipping.`);
                continue;
              }

              try {
                savedArtist = await Artist.create(artistData);
                console.log(`Created artist: ${savedArtist.name}`);
              } catch (createError) {
                console.error(`Error creating artist ${artist.name}:`, createError.message);
                console.log('Artist data:', JSON.stringify(artistData, null, 2));
                continue;
              }
            }

            // Import artist's releases
            await importArtistReleases(savedArtist._id, artist.id);

            processedCount++;

            // Delay between artists
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`Error importing artist ${artist.name}:`, error.message);
          }
        }
      } catch (error) {
        if (error.body?.error?.message === 'The access token expired') {
          await getValidToken();
          console.log('Token refreshed. Retrying...');
          continue;
        }
        console.error(`Error processing genre ${genre.name}:`, error.message);
      }
    }

    console.log('\n=== Data import completed successfully ===');

    // Summary statistics
    console.log('\nImport Summary:');
    console.log(`Genres processed: ${processedCache.genres.size}`);
    console.log(`Artists processed: ${processedCache.artists.size}`);
    console.log(`Releases processed: ${processedCache.releases.size}`);
    console.log(`Tracks processed: ${processedCache.tracks.size}`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error importing data:', error);
    process.exit(1);
  }
};

export { importSpotifyData };

// Run if called directly
if (import.meta.url === new URL(import.meta.resolve('./scripts/importSpotifyData.js'))) {
  importSpotifyData();
}

importSpotifyData()
