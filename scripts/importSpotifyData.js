const mongoose = require('mongoose');
const {
  spotifyApi,
  getValidToken
} = require('../utils/spotify/spotifyClient');
const Artist = require('../models/artist.model');
const Release = require('../models/releases.model');
const Track = require('../models/track.model');
const Song = require('../models/song.model');
const Genre = require('../models/genre.model');
require('dotenv').config();

const genreCategories = [
    // { name: 'Rock', image: '/api/placeholder/300/200', description: 'Guitar-driven music spanning from classic to alternative rock' },
    // { name: 'Pop', image: '/api/placeholder/300/200', description: 'Mainstream contemporary popular music' },
    // { name: 'Hip Hop', image: '/api/placeholder/300/200', description: 'Urban music characterized by rhythmic vocals and beats' },
    // { name: 'Electronic', image: '/api/placeholder/300/200', description: 'Computer-generated music including house, techno, and EDM' },
    // { name: 'Jazz', image: '/api/placeholder/300/200', description: 'Improvisational music rooted in blues and ragtime' },
    // { name: 'Classical', image: '/api/placeholder/300/200', description: 'Traditional Western orchestral and chamber music' },
    { name: 'R&B', image: '/api/placeholder/300/200', description: 'Rhythm and blues music with soul influences' },
    { name: 'Country', image: '/api/placeholder/300/200', description: 'American folk music with rural roots' },
    { name: 'Metal', image: '/api/placeholder/300/200', description: 'Heavy guitar-based music with intense vocals' },
    { name: 'Indie', image: '/api/placeholder/300/200', description: 'Independent and alternative music across genres' },
    { name: 'Afrobeats', image: '/api/placeholder/300/200', description: 'Contemporary African popular music blending West African musical styles' },
    { name: 'K-Pop', image: '/api/placeholder/300/200', description: 'South Korean popular music known for its stylized approach' },
    { name: 'Latin', image: '/api/placeholder/300/200', description: 'Music from Latin America including reggaeton, salsa, and bachata' },
    // { name: 'Reggae', image: '/api/placeholder/300/200', description: 'Jamaican music characterized by offbeat rhythms and bass lines' },
    // { name: 'Folk', image: '/api/placeholder/300/200', description: 'Traditional and contemporary acoustic-based music' },
    // { name: 'Blues', image: '/api/placeholder/300/200', description: 'African-American origin music based on the blues scale' },
    // { name: 'Soul', image: '/api/placeholder/300/200', description: 'African-American music combining elements of gospel and rhythm and blues' },
    // { name: 'Funk', image: '/api/placeholder/300/200', description: 'Rhythmic music emphasizing strong bass lines and electric instruments' },
    // { name: 'Punk', image: '/api/placeholder/300/200', description: 'Fast-paced, aggressive rock music with political themes' },
    // { name: 'Gospel', image: '/api/placeholder/300/200', description: 'Christian religious music with strong vocal harmonies' },
    // { name: 'Alternative', image: '/api/placeholder/300/200', description: 'Music outside mainstream rock and pop styles' },
    // { name: 'Ambient', image: '/api/placeholder/300/200', description: 'Atmospheric electronic music emphasizing tone and texture' },
    // { name: 'World', image: '/api/placeholder/300/200', description: 'Traditional and folk music from various global cultures' },
    // { name: 'Trap', image: '/api/placeholder/300/200', description: 'Hip hop subgenre characterized by heavy bass and drum patterns' },
    // { name: 'Instrumental', image: '/api/placeholder/300/200', description: 'Music without vocals across various genres' }
  ];

  const transformSpotifyArtist = async (spotifyArtist) => {
    let biography;
    try {
      const artistInfo = await spotifyApi.getArtist(spotifyArtist.id);
      biography = artistInfo.body.biography || `${spotifyArtist.name} is an artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`;
    } catch (error) {
      console.warn(`Could not fetch bio for ${spotifyArtist.name}:`, error.message);
      biography = `${spotifyArtist.name} is an artist with ${spotifyArtist.followers?.total || 0} followers on Spotify.`;
    }

    const timestamp = Date.now();
    return {
      name: spotifyArtist.name,
      artistId: spotifyArtist.id,
      email: `artist_${spotifyArtist.id}_${timestamp}@placeholder.com`,
      password: `spotify_${spotifyArtist.id}`,
      images: spotifyArtist.images?.map(img => ({
        url: img.url,
        height: img.height,
        width: img.width
      })) || [],
      genres: spotifyArtist.genres || [],
      biography: biography,
      monthlyListeners: 0,
      followers: spotifyArtist.followers?.total || 0,
      verified: true,
      socialLinks: {
        spotify: spotifyArtist.external_urls?.spotify,
        instagram: null,
        twitter: null,
        facebook: null,
        website: null
      },
      popularity: spotifyArtist.popularity || 0,
      topTracks: [],
      roles: ['musician'],
      labels: [],
      country: spotifyArtist.country || null,
      isActive: true
    };
  };

  const transformRelease = (spotifyAlbum, artistId) => ({
    title: spotifyAlbum.name,
    artistId,
    type: spotifyAlbum.album_type,
    dates: {
      release_date: new Date(spotifyAlbum.release_date),
      original_release_date: new Date(spotifyAlbum.release_date),
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
      genre: [spotifyAlbum.genres?.[0] || 'unknown'],
      subGenres: spotifyAlbum.genres?.slice(1) || [],
      totalTracks: spotifyAlbum.total_tracks,
      duration: spotifyAlbum.tracks?.items?.reduce((acc, track) => acc + track.duration_ms, 0) || 0,
      recordingType: 'studio',
      language: 'en'
    },
    commercial: {
      label: spotifyAlbum.label || 'Independent',
      upc: spotifyAlbum.external_ids?.upc
    },
    availability: {
      platforms: [{
        name: 'Spotify',
        url: spotifyAlbum.external_urls?.spotify,
        available: true
      }]
    },
    analytics: {
      totalStreams: 0,
      uniqueListeners: 0,
      saves: 0,
      presaves: 0,
      shares: {
        total: 0,
        platforms: {
          spotify: 0,
          apple: 0,
          facebook: 0,
          instagram: 0,
          twitter: 0
        }
      },
      playlists: {
        total: 0,
        editorial: 0,
        user: 0
      }
    },
    credits: [{
      role: 'Primary Artist',
      artistId,
      primary: true,
      contribution: 'Performance'
    }],
    description: {
      main: `${spotifyAlbum.name} - ${spotifyAlbum.album_type} by ${spotifyAlbum.artists[0].name}`,
      short: spotifyAlbum.name
    },
    contentInfo: {
      isExplicit: spotifyAlbum.tracks?.items?.some(track => track.explicit) || false,
      parentalAdvisory: spotifyAlbum.tracks?.items?.some(track => track.explicit) || false
    }
  });

  const transformSpotifyTrack = (spotifyTrack, artistId, releaseId, releaseType) => {
    const releaseYear = spotifyTrack.album?.release_date ?
      new Date(spotifyTrack.album.release_date).getFullYear() :
      new Date().getFullYear();

    return {
      releaseId,
      songId: null, // Set later after song creation
      title: spotifyTrack.name,
      version: 'Original',
      duration: spotifyTrack.duration_ms,
      track_number: spotifyTrack.track_number,
      disc_number: spotifyTrack.disc_number || 1,
      artistId,
      metadata: {
        genre: [spotifyTrack.genres?.[0] || 'unknown'],
        bpm: Math.floor(Math.random() * 40) + 80,
        key: ['C', 'G', 'D', 'A', 'E', 'B', 'F'][Math.floor(Math.random() * 7)],
        mood: ['Energetic', 'Calm', 'Melancholic', 'Happy'][Math.floor(Math.random() * 4)],
        tags: [],
        isrc: spotifyTrack.external_ids?.isrc,
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
        skipCount: Math.floor(Math.random() * 1000),
        completionRate: Math.random() * 0.3 + 0.7,
        averageListenTime: Math.floor(Math.random() * spotifyTrack.duration_ms),
        playlists: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 200)
      },
      regionalData: [{
        region: 'US',
        streams: Math.floor(Math.random() * 1000000),
        shares: Math.floor(Math.random() * 5000),
        playlists: Math.floor(Math.random() * 1000),
        skipRate: Math.random() * 0.3
      }, {
        region: 'UK',
        streams: Math.floor(Math.random() * 500000),
        shares: Math.floor(Math.random() * 2500),
        playlists: Math.floor(Math.random() * 500),
        skipRate: Math.random() * 0.3
      }],
      flags: {
        isExplicit: spotifyTrack.explicit || false,
        isInstrumental: false,
        isLive: spotifyTrack.name.toLowerCase().includes('live'),
        isAcoustic: spotifyTrack.name.toLowerCase().includes('acoustic'),
        isRemix: spotifyTrack.name.toLowerCase().includes('remix'),
        hasLyrics: true
      }
    };
  };

  const transformSpotifySong = (spotifyTrack, stats) => ({
    fileUrl: spotifyTrack.preview_url || 'placeholder_url',
    duration: spotifyTrack.duration_ms,
    bitrate: 320,
    format: 'mp3',
    analytics: {
      totalStreams: stats.totalStreams,
      uniqueListeners: stats.uniqueListeners,
      playlistAdditions: stats.playlistAdditions,
      shares: {
        total: stats.shares.total,
        platforms: {
          facebook: stats.shares.platforms.facebook,
          twitter: stats.shares.platforms.twitter,
          whatsapp: stats.shares.platforms.whatsapp,
          other: stats.shares.platforms.other
        }
      },
      likes: stats.likes,
      comments: Math.floor(Math.random() * 100),
      downloads: Math.floor(Math.random() * 1000)
    },
    streamHistory: [],
    engagement: {
      skipRate: Math.random() * 0.3,
      averageCompletionRate: Math.random() * 0.3 + 0.7,
      repeatListenRate: Math.random() * 0.5,
      peakListeningTimes: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: Math.floor(Math.random() * 1000)
      }))
    },
    playlists: [],
    waveform: [],
    lyrics: "",
    isrc: spotifyTrack.external_ids?.isrc || `TEMP${Date.now()}${Math.floor(Math.random() * 1000)}`, // Generate temporary ISRC if none exists
    audioQuality: {
      peak: Math.random(),
      averageVolume: Math.random() * 0.8,
      dynamicRange: Math.random() * 20
    },
    flags: {
      isExplicit: spotifyTrack.explicit || false,
      containsExplicitLanguage: spotifyTrack.explicit || false,
      isInstrumental: false,
      hasLyrics: true
    }
  });

  const generateRandomStats = () => ({
    totalStreams: Math.floor(Math.random() * 1000000),
    uniqueListeners: Math.floor(Math.random() * 500000),
    playlistAdditions: Math.floor(Math.random() * 10000),
    shares: {
      total: Math.floor(Math.random() * 5000),
      platforms: {
        facebook: Math.floor(Math.random() * 1000),
        twitter: Math.floor(Math.random() * 1000),
        whatsapp: Math.floor(Math.random() * 1000),
        other: Math.floor(Math.random() * 1000)
      }
    },
    likes: Math.floor(Math.random() * 50000)
  });

  const importGenres = async () => {
    console.log('Importing base genres...');
    for (const genre of genreCategories) {
      await Genre.findOneAndUpdate(
        { name: genre.name },
        genre,
        { upsert: true, new: true }
      );
    }
  };

  const importArtistReleases = async (artistId, spotifyArtistId) => {
    try {
      await getValidToken(); // Refresh token before fetching albums

      const albums = await spotifyApi.getArtistAlbums(spotifyArtistId, {
        limit: 50,
        include_groups: 'album,single,ep'
      });

      for (const album of albums.body.items) {
        try {
          await getValidToken(); // Refresh token before each album processing

          const releaseData = transformRelease(album, artistId);
          const release = await Release.findOneAndUpdate(
            { title: releaseData.title, artistId: releaseData.artistId },
            releaseData,
            { upsert: true, new: true }
          );

          const tracks = await spotifyApi.getAlbumTracks(album.id);
          for (const track of tracks.body.items) {
            const songData = transformSpotifySong(track, generateRandomStats());
            const song = await Song.create(songData);

            const trackData = transformSpotifyTrack(track, artistId, release._id, release.type);
            trackData.songId = song._id;
            await Track.create(trackData);
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          if (error.body?.error?.message === 'The access token expired') {
            await getValidToken();
            continue; // Retry the current album after token refresh
          }
          console.error(`Error importing release ${album.name}:`, error.message);
        }
      }
    } catch (error) {
      if (error.body?.error?.message === 'The access token expired') {
        await getValidToken();
        return importArtistReleases(artistId, spotifyArtistId); // Retry the entire function
      }
      throw error;
    }
  };

  const importSpotifyData = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');

      await getValidToken();
      await importGenres();

      for (const genre of genreCategories) {
        try {
          console.log(`Importing ${genre.name} artists...`);
          await getValidToken(); // Refresh token before each genre

          const artists = await spotifyApi.searchArtists(`genre:${genre.name.toLowerCase()}`, { limit: 5 });

          for (const artist of artists.body.artists.items) {
            try {
              const artistData = await transformSpotifyArtist(artist);
              const savedArtist = await Artist.findOneAndUpdate(
                { artistId: artistData.artistId },
                artistData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );

              await importArtistReleases(savedArtist._id, artist.id);
              console.log(`Imported ${artist.name} with their releases`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`Error importing artist ${artist.name}:`, error.message);
            }
          }
        } catch (error) {
          if (error.body?.error?.message === 'The access token expired') {
            await getValidToken();
            continue; // Retry the current genre after token refresh
          }
          throw error;
        }
      }

      console.log('Data import completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error importing data:', error);
      process.exit(1);
    }
  };

  module.exports = { importSpotifyData };

  if (require.main === module) {
    importSpotifyData();
  }
