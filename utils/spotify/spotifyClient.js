
import { config } from 'dotenv';
import SpotifyWebApi from 'spotify-web-api-node';
// import axios from 'axios';

// Loads .env
config()

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env["SPOTIFY_CLIENT_SECRET"].trim() || "cd2d24b155a943adb6b8b75ab6553fe8",
});

// Automatically handle token refresh
let tokenExpirationTime = 0;

const getValidToken = async () => {
  const now = Date.now();
  if (now >= tokenExpirationTime) {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    // Set expiration time (subtract 1 minute for safety margin)
    tokenExpirationTime = now + (data.body.expires_in - 60) * 1000;
  }
  return spotifyApi.getAccessToken();
};

// Transform Spotify data to match our schema
const transformSpotifyArtist = (spotifyArtist) => ({
  name: spotifyArtist.name,
  profileImage: spotifyArtist.images?.[0]?.url || '',
  bio: spotifyArtist.bio || '',
  genre: spotifyArtist.genres?.[0] || 'unknown',
  verified: true,
  spotifyId: spotifyArtist.id,
  metadata: {
    followers: spotifyArtist.followers?.total || 0,
    popularity: spotifyArtist.popularity || 0,
    genres: spotifyArtist.genres || [],
    externalUrls: spotifyArtist.external_urls || {}
  }
});

const transformSpotifyTrack = (spotifyTrack, artistId, releaseId) => ({
  title: spotifyTrack.name,
  duration: spotifyTrack.duration_ms || 0,
  track_number: spotifyTrack.track_number || 1,
  artistId,
  releaseId,
  metadata: {
    isrc: spotifyTrack.external_ids?.isrc || null,
    popularity: spotifyTrack.popularity || 0,
    previewUrl: spotifyTrack.preview_url || null,
    spotifyId: spotifyTrack.id
  },
  flags: {
    isExplicit: spotifyTrack.explicit || false,
    isInstrumental: false,
    hasLyrics: true
  }
});

const transformSpotifyAlbum = (spotifyAlbum, artistId) => ({
  title: spotifyAlbum.name,
  artistId,
  type: spotifyAlbum.album_type || 'album',
  dates: {
    release_date: spotifyAlbum.release_date ? new Date(spotifyAlbum.release_date) : new Date(),
    announcement_date: new Date()
  },
  artwork: {
    cover_image: {
      high: spotifyAlbum.images?.[0]?.url || '',
      medium: spotifyAlbum.images?.[1]?.url || '',
      low: spotifyAlbum.images?.[2]?.url || '',
      thumbnail: spotifyAlbum.images?.[2]?.url || ''
    }
  },
  metadata: {
    totalTracks: spotifyAlbum.total_tracks || 0,
    spotifyId: spotifyAlbum.id,
    popularity: spotifyAlbum.popularity || 0
  },
  commercial: {
    label: spotifyAlbum.label || 'Unknown'
  },
  contentInfo: {
    isExplicit: spotifyAlbum.explicit || false
  }
});

export {
  spotifyApi,
  getValidToken,
  transformSpotifyArtist,
  transformSpotifyTrack,
  transformSpotifyAlbum
};
