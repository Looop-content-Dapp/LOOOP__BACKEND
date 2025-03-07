import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import {Artist} from '../models/artist.model.js'; // Adjust path to your Artist model
import {Genre} from '../models/genre.model.js';   // Adjust path to your Genre model
import {Album} from '../models/album.model.js';
import {Track} from '../models/track.model.js';

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initial base genre categories (add at the top of the file after imports)
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

// Modified getOrCreateGenres function
const getOrCreateGenres = async (genreNames) => {
  if (!genreNames || genreNames.length === 0) return [];

  const genreIds = [];
  for (const name of genreNames) {
    try {
      // Normalize genre name
      const normalizedName = name.toLowerCase();

      // Find existing genre case-insensitive
      let genre = await Genre.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (!genre) {
        // Create new genre with description
        genre = new Genre({
          name: name,
          image: '/api/placeholder/300/200',
          description: `Music categorized as ${name}`
        });
        await genre.save();
        console.log(`Created new genre: ${name}`);
      }

      genreIds.push(genre._id);
    } catch (error) {
      console.warn(`Could not process genre "${name}":`, error.message);
    }
  }
  return genreIds;
};

// Add importGenres function
const importGenres = async () => {
  console.log('Importing base genres...');

  for (const genre of genreCategories) {
    try {
      const existingGenre = await Genre.findOne({
        name: { $regex: new RegExp(`^${genre.name}$`, 'i') }
      });

      if (existingGenre) {
        console.log(`Genre ${genre.name} already exists, skipping`);
        continue;
      }

      await Genre.create(genre);
      console.log(`Imported genre: ${genre.name}`);
    } catch (error) {
      console.error(`Error importing genre ${genre.name}:`, error.message);
    }
  }

  console.log('Genre import completed');
};

// Modify the main execution to import base genres first
const main = async () => {
  try {
    await importGenres(); // Import base genres first
    await importArtistByName(artistName);
    console.log("Import completed successfully");
  } catch (error) {
    console.error("Import failed:", error.message);
  } finally {
    mongoose.connection.close();
  }
};

// Replace the existing execution code with the new main function
main();

// Map Spotify artist data to Artist schema
const mapSpotifyToArtist = async (spotifyArtist) => {
  const genres = await getOrCreateGenres(spotifyArtist.genres || []);

  return {
    artistId: spotifyArtist.id || null,
    name: spotifyArtist.name,
    email: `artist_${spotifyArtist.id}@placeholder.com`,
    profileImage: spotifyArtist.images?.[0]?.url || null,
    biography: `${spotifyArtist.name} is a music artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`, // Default biography
    address1: "Unknown Address",
    country: "Unknown",
    city: "Unknown",
    genres,
    monthlyListeners: spotifyArtist.followers?.total || 0,
    followers: spotifyArtist.followers?.total || 0,
    popularity: spotifyArtist.popularity || 0,
    socialLinks: {
      spotify: `https://open.spotify.com/artist/${spotifyArtist.id}`,
    },
  };
};

// Import artist function
// Add function to get artist's albums
const getArtistAlbums = async (artistId, token) => {
  const albums = [];
  let url = `https://api.spotify.com/v1/artists/${artistId}/albums`;
  
  while (url) {
    const response = await axios.get(url, {
      params: {
        include_groups: 'album,single,ep',
        limit: 50,
        market: 'US'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    albums.push(...response.data.items);
    url = response.data.next;
  }
  
  return albums;
};

// Add function to get album tracks
const getAlbumTracks = async (albumId, token) => {
  const tracks = [];
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks`;
  
  while (url) {
    const response = await axios.get(url, {
      params: { limit: 50 },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    tracks.push(...response.data.items);
    url = response.data.next;
  }
  
  return tracks;
};

// Add function to import album and its tracks
const importAlbum = async (albumData, artistId, token) => {
  try {
    // Check if album already exists
    let existingAlbum = await Album.findOne({ albumId: albumData.id });
    if (existingAlbum) {
      console.log(`Album ${albumData.name} already exists, skipping`);
      return existingAlbum;
    }

    // Get full album details including tracks
    const tracks = await getAlbumTracks(albumData.id, token);
    
    const album = new Album({
      albumId: albumData.id,
      name: albumData.name,
      type: albumData.album_type,
      releaseDate: albumData.release_date,
      totalTracks: albumData.total_tracks,
      coverImage: albumData.images?.[0]?.url || null,
      artist: artistId,
      spotifyUrl: albumData.external_urls?.spotify
    });
    
    await album.save();
    console.log(`Imported album: ${album.name}`);

    // Import tracks
    for (const trackData of tracks) {
      const track = new Track({
        trackId: trackData.id,
        name: trackData.name,
        durationMs: trackData.duration_ms,
        trackNumber: trackData.track_number,
        discNumber: trackData.disc_number,
        album: album._id,
        artist: artistId,
        spotifyUrl: trackData.external_urls?.spotify,
        previewUrl: trackData.preview_url
      });
      
      await track.save();
      console.log(`Imported track: ${track.name}`);
    }

    return album;
  } catch (error) {
    console.error(`Error importing album ${albumData.name}:`, error.message);
    throw error;
  }
};

// Modify importArtist function to include albums import
const importArtist = async (spotifyArtist) => {
  try {
    const artistData = await mapSpotifyToArtist(spotifyArtist);
    const artist = new Artist(artistData);
    await artist.save();
    console.log(`Imported artist: ${artist.name}`);

    // Get token for albums import
    const token = await getSpotifyToken();
    
    // Get and import all albums
    const albums = await getArtistAlbums(spotifyArtist.id, token);
    for (const albumData of albums) {
      await importAlbum(albumData, artist._id, token);
    }

    return artist;
  } catch (error) {
    console.error("Error during import:", error.message);
    throw error;
  }
};

// Add Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Function to get Spotify access token
const getSpotifyToken = async () => {
  const response = await axios.post('https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
};

// Function to search for artist by name
const searchArtist = async (name) => {
  const token = await getSpotifyToken();
  const response = await axios.get(`https://api.spotify.com/v1/search`, {
    params: {
      q: name,
      type: 'artist',
      limit: 1
    },
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.data.artists.items.length) {
    throw new Error(`Artist "${name}" not found on Spotify`);
  }

  return response.data.artists.items[0];
};

// Modified main function to accept artist name
const importArtistByName = async (artistName) => {
  try {
    const spotifyArtist = await searchArtist(artistName);
    return await importArtist(spotifyArtist);
  } catch (error) {
    console.error("Error during import:", error.message);
    throw error;
  }
};

// Modified example usage
const artistName = "Olamide"; // Replace with any artist name

importArtistByName(artistName)
  .then(() => {
    console.log("Import completed successfully");
    mongoose.connection.close();
  })
  .catch((error) => {
    console.error("Import failed:", error.message);
    mongoose.connection.close();
  });
