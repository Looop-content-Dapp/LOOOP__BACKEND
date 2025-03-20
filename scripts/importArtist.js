import 'dotenv/config';
import mongoose from 'mongoose';
import { spotifyApi, getValidToken } from '../utils/spotify/spotifyClient.js';
import { Artist } from '../models/artist.model.js';
import { Genre } from '../models/genre.model.js';
import { Release } from '../models/releases.model.js';
import { Track } from '../models/track.model.js';
import { Song } from '../models/song.model.js';
import crypto from 'crypto';

// Track processed items to avoid duplicates
const processedCache = {
  artists: new Set(),
  releases: new Set(),
  tracks: new Set(),
  genres: new Set()
};

// Initial base genre categories
const genreCategories = [
  { name: 'Afrobeats', image: '/api/placeholder/300/200', description: 'Contemporary African popular music blending West African musical styles' },
  { name: 'Country', image: '/api/placeholder/300/200', description: 'American folk music with rural roots' },
  { name: 'Metal', image: '/api/placeholder/300/200', description: 'Heavy guitar-based music with intense vocals' },
  { name: 'Indie', image: '/api/placeholder/300/200', description: 'Independent and alternative music across genres' },
  { name: 'K-Pop', image: '/api/placeholder/300/200', description: 'South Korean popular music known for its stylized approach' },
  { name: 'Latin', image: '/api/placeholder/300/200', description: 'Music from Latin America including reggaeton, salsa, and bachata' },
  { name: 'Rock', image: '/api/placeholder/300/200', description: 'Guitar-driven music spanning from classic to alternative rock' },
  { name: 'Pop', image: '/api/placeholder/300/200', description: 'Mainstream contemporary popular music' },
  { name: 'Hip Hop', image: '/api/placeholder/300/200', description: 'Urban music characterized by rhythmic vocals and beats' },
  { name: 'Electronic', image: '/api/placeholder/300/200', description: 'Computer-generated music including house, techno, and EDM' }
];

/**
 * Create a consistent ObjectId from a string
 */
const createObjectId = (str) => {
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 24);
  return new mongoose.Types.ObjectId(hash);
};

/**
 * Get or create genres and return their ObjectIds
 */
const getGenreIds = async (genreNames = []) => {
  if (!genreNames.length) return [];

  const genreIds = [];
  for (const genreName of genreNames) {
    try {
      const normalizedName = genreName.toLowerCase();

      if (processedCache.genres.has(normalizedName)) {
        const existingGenre = await Genre.findOne({
          name: { $regex: new RegExp(`^${genreName}$`, 'i') }
        });
        if (existingGenre) {
          genreIds.push(existingGenre._id);
          continue;
        }
      }

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
 * Transform Spotify artist data
 */
const transformArtist = async (spotifyArtist) => {
  if (processedCache.artists.has(spotifyArtist.id)) {
    const existingArtist = await Artist.findOne({ artistId: spotifyArtist.id });
    if (existingArtist) return existingArtist;
  }

  const userId = createObjectId(spotifyArtist.id);
  const genreIds = await getGenreIds(spotifyArtist.genres || []);
  const timestamp = Date.now();

  let biography = `${spotifyArtist.name} is an artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`;
  if (spotifyArtist.genres?.length) {
    biography += ` Their music can be described as ${spotifyArtist.genres.join(', ')}.`;
  }

  processedCache.artists.add(spotifyArtist.id);

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
    userId,
    genres: genreIds,
  };
};

/**
 * Transform release data
 */
const transformRelease = (spotifyAlbum, artistId) => {
  const releaseKey = `${artistId}_${spotifyAlbum.id}`;

  if (processedCache.releases.has(releaseKey)) {
    console.log(`Release ${spotifyAlbum.name} already processed, skipping`);
    return null;
  }

  const releaseDate = new Date(spotifyAlbum.release_date || new Date().toISOString().split('T')[0]);
  processedCache.releases.add(releaseKey);

  return {
    title: spotifyAlbum.name,
    artistId,
    type: spotifyAlbum.album_type,
    spotifyId: spotifyAlbum.id,
    verificationStatus: 'approved', // Set verification status to approved
    verifiedAt: new Date(),        // Add verification date
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
      }
    },
    metadata: {
      genre: spotifyAlbum.genres?.length ? [spotifyAlbum.genres[0]] : ['unknown'],
      totalTracks: spotifyAlbum.total_tracks || 0,
      duration: spotifyAlbum.tracks?.items?.reduce((acc, track) => acc + (track.duration_ms || 0), 0) || 0,
      language: 'en'
    },
    commercial: {
      label: spotifyAlbum.label || 'Independent',
      upc: spotifyAlbum.external_ids?.upc || `TEMP-UPC-${Date.now()}`
    },
    description: {
      main: `${spotifyAlbum.name} - ${spotifyAlbum.album_type} by ${spotifyAlbum.artists?.[0]?.name || 'Unknown Artist'}`,
      short: spotifyAlbum.name
    }
  };
};

/**
 * Import artist's releases
 */
const importArtistReleases = async (artistId, spotifyArtistId) => {
  try {
    await getValidToken();
    console.log(`Fetching releases for artist ID: ${spotifyArtistId}`);

    const albums = await spotifyApi.getArtistAlbums(spotifyArtistId, {
      limit: 20,
      include_groups: 'album,single,ep'
    });

    console.log(`Found ${albums.body.items.length} releases`);

    for (const album of albums.body.items) {
      try {
        const releaseData = transformRelease(album, artistId);
        if (!releaseData) continue;

        const release = await Release.create(releaseData);
        console.log(`Imported release: ${release.title}`);

        // Get and import tracks
        const tracksResponse = await spotifyApi.getAlbumTracks(album.id);
        for (const track of tracksResponse.body.items) {
          const randomShares = Math.floor(Math.random() * 50);
          const uniqueIsrc = `TEMP${Date.now()}${Math.floor(Math.random() * 10000)}`;

          const song = await Song.create({
            spotifyId: track.id,
            duration: track.duration_ms,
            fileUrl: track.preview_url || 'placeholder_url',
            format: 'mp3',
            bitrate: 320,
            isrc: uniqueIsrc,
            analytics: {
              totalStreams: Math.floor(Math.random() * 10000),
              uniqueListeners: Math.floor(Math.random() * 5000),
              playlistAdditions: Math.floor(Math.random() * 100),
              shares: {
                total: randomShares,
                platforms: {
                  facebook: Math.floor(randomShares * 0.4),
                  twitter: Math.floor(randomShares * 0.3),
                  whatsapp: Math.floor(randomShares * 0.2),
                  other: Math.floor(randomShares * 0.1)
                }
              },
              likes: Math.floor(Math.random() * 500),
              comments: Math.floor(Math.random() * 100),
              downloads: Math.floor(Math.random() * 1000)
            },
            waveform: Array.from({ length: 100 }, () => Math.random()),
            audioQuality: {
              peak: Math.random(),
              averageVolume: Math.random() * 0.8,
              dynamicRange: Math.random() * 20
            }
          });

          await Track.create({
            title: track.name,
            spotifyId: track.id,
            releaseId: release._id,
            songId: song._id,
            artistId,
            duration: track.duration_ms,
            track_number: track.track_number,
            disc_number: track.disc_number
          });
        }
      } catch (error) {
        console.error(`Error importing release ${album.name}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Failed to import releases for artist ${spotifyArtistId}:`, error.message);
  }
};

/**
 * Main import function
 */
const importArtistByName = async (artistName) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await getValidToken();

    // Search for artist
    const searchResults = await spotifyApi.searchArtists(artistName, { limit: 1 });
    if (!searchResults.body.artists.items.length) {
      throw new Error(`Artist "${artistName}" not found`);
    }

    const spotifyArtist = searchResults.body.artists.items[0];

    // Transform and save artist
    const artistData = await transformArtist(spotifyArtist);
    const artist = await Artist.create(artistData);
    console.log(`Imported artist: ${artist.name}`);

    // Import releases
    await importArtistReleases(artist._id, spotifyArtist.id);

    console.log('Import completed successfully');
  } catch (error) {
    console.error('Import failed:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
};

// Example usage
const artistName = process.argv[2] || "";
importArtistByName(artistName)
  .catch(console.error);
