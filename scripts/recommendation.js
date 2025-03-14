const tf = require('@tensorflow/tfjs');
const _ = require('lodash');
const mongoose = require('mongoose');

// Models from your schema files
const { Artist } = require('../models/artist.model');
const { Track } = require('../models/track.model');
const { Release } = require('../models/releases.model');
const { Song } = require('../models/song.model');
const { LastPlayed } = require('../models/lastplayed.model');

// Configuration
const RECOMMENDATION_COUNT = 10;
const NEW_RELEASE_DAYS = 30;
const FEATURE_WEIGHTS = {
  genre: 0.4,
  analytics: 0.3,
  mood: 0.2,
  engagement: 0.1
};

// Feature extraction for artists
async function extractArtistsFeatures(artistIds) {
  const artists = await Artist.find({ _id: { $in: artistIds } });
  const releases = await Release.find({ artistId: { $in: artistIds } });
  const tracks = await Track.find({ artistId: { $in: artistIds } });
  const songs = await Song.find({ _id: { $in: tracks.map(t => t.songId) } });

  const genreFreq = _.countBy(_.flatMap(tracks, t => t.metadata.genre));
  const totalGenres = _.sum(Object.values(genreFreq));
  const genreVector = normalizeVector(genreFreq);

  const analytics = {
    streams: _.mean(songs.map(s => s.analytics.totalStreams)) || 0,
    playlistAdditions: _.mean(songs.map(s => s.analytics.playlistAdditions)) || 0,
    shares: _.mean(songs.map(s => s.analytics.shares.total)) || 0,
    engagementScore: _.mean(songs.map(s => s.engagementScore || 0)) || 0
  };

  const maxValues = { streams: 1000000, playlistAdditions: 10000, shares: 5000, engagementScore: 100000 };
  const normalizedAnalytics = {
    streams: analytics.streams / maxValues.streams,
    playlistAdditions: analytics.playlistAdditions / maxValues.playlistAdditions,
    shares: analytics.shares / maxValues.shares,
    engagementScore: analytics.engagementScore / maxValues.engagementScore
  };

  const moodFreq = _.countBy(_.flatMap(tracks, t => t.metadata.mood || []));
  const moodVector = normalizeVector(moodFreq);

  return { artistIds, genreVector, analytics: normalizedAnalytics, moodVector, releases, tracks, artists };
}

// Cosine similarity
function cosineSimilarity(vecA, vecB) {
  const keys = _.union(Object.keys(vecA), Object.keys(vecB));
  const a = keys.map(k => vecA[k] || 0);
  const b = keys.map(k => vecB[k] || 0);
  return tf.dot(tf.tensor1d(a), tf.tensor1d(b)).dataSync()[0] /
         (tf.norm(tf.tensor1d(a)).dataSync()[0] * tf.norm(tf.tensor1d(b)).dataSync()[0]) || 0;
}

// User listening profile
async function getUserListeningProfile(userId) {
  const history = await LastPlayed.find({
    userId,
    timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  }).populate('trackId');

  const genreFreq = _.countBy(_.flatMap(history, h => h.trackId?.metadata.genre || []));
  const moodFreq = _.countBy(_.flatMap(history, h => h.trackId?.metadata.mood || []));
  const artistFreq = _.countBy(history, h => h.trackId?.artistId.toString());

  return {
    genres: normalizeVector(genreFreq),
    moods: normalizeVector(moodFreq),
    artists: artistFreq,
    totalPlays: history.length
  };
}

// Generate Deezer-like dashboard
async function generateDeezerDashboard(userId, artistIds = []) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Get user listening profile
    const userProfile = await getUserListeningProfile(userId);
    const selectedFeatures = artistIds.length ? await extractArtistsFeatures(artistIds) : null;
    const allArtists = await Artist.find({ _id: { $nin: artistIds } }).limit(100);

    // 1. Flow (Personalized Mix)
    const flowTracks = await Track.aggregate([
      {
        $match: {
          $or: [
            { 'metadata.genre': { $in: Object.keys(userProfile.genres) } },
            ...(artistIds.length ? [{ artistId: { $in: artistIds } }] : [])
          ]
        }
      },
      { $lookup: { from: 'songs', localField: 'songId', foreignField: '_id', as: 'songData' } },
      { $unwind: '$songData' },
      { $lookup: { from: 'releases', localField: 'releaseId', foreignField: '_id', as: 'release' } },
      { $unwind: '$release' },
      { $lookup: { from: 'artists', localField: 'artistId', foreignField: '_id', as: 'artist' } },
      { $unwind: '$artist' },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $size: { $setIntersection: ['$metadata.genre', Object.keys(userProfile.genres)] } }, FEATURE_WEIGHTS.genre] },
              { $multiply: ['$songData.analytics.totalStreams', FEATURE_WEIGHTS.analytics] },
              ...(selectedFeatures ? [{ $multiply: [{ $cond: { if: { $in: ['$artistId', selectedFeatures.artistIds] }, then: 1000, else: 0 } }, 0.1] }] : [])
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 20 }
    ]);

    // 2. New Releases
    const newReleases = await Release.aggregate([
      {
        $match: {
          'dates.release_date': { $gte: new Date(Date.now() - NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000) },
          ...(artistIds.length ? { artistId: { $in: artistIds } } : {})
        }
      },
      { $lookup: { from: 'artists', localField: 'artistId', foreignField: '_id', as: 'artist' } },
      { $unwind: '$artist' },
      { $lookup: { from: 'tracks', localField: '_id', foreignField: 'releaseId', as: 'tracks' } },
      { $sort: { 'dates.release_date': -1 } },
      { $limit: 5 }
    ]);

    // 3. Recommended Playlists (Genre-based)
    const topGenres = _.keys(userProfile.genres).sort((a, b) => userProfile.genres[b] - userProfile.genres[a]).slice(0, 3);
    const playlists = await Promise.all(topGenres.map(async genre => {
      const tracks = await Track.find({ 'metadata.genre': genre })
        .populate('songId releaseId artistId')
        .sort({ 'songId.analytics.totalStreams': -1 })
        .limit(10);
      return {
        title: `${genre} Essentials`,
        tracks: tracks.map(t => ({
          id: t._id,
          title: t.title,
          artist: t.artistId.name,
          artwork: t.releaseId.artwork.cover_image
        })),
        genre
      };
    }));

    // 4. Top Charts (Worldwide)
    const topCharts = await Track.aggregate([
      { $lookup: { from: 'songs', localField: 'songId', foreignField: '_id', as: 'songData' } },
      { $unwind: '$songData' },
      { $sort: { 'songData.analytics.totalStreams': -1 } },
      { $limit: 10 },
      { $lookup: { from: 'artists', localField: 'artistId', foreignField: '_id', as: 'artist' } },
      { $unwind: '$artist' },
      { $lookup: { from: 'releases', localField: 'releaseId', foreignField: '_id', as: 'release' } },
      { $unwind: '$release' }
    ]);

    // 5. Artists You Might Like
    const similarArtists = artistIds.length ? await clusterArtists(selectedFeatures, allArtists) :
      await Artist.find({ _id: { $in: _.keys(userProfile.artists).slice(0, 5).map(id => new mongoose.Types.ObjectId(id)) } });

    // Construct dashboard
    const dashboard = {
      flow: {
        title: 'Your Flow',
        description: 'A mix tailored to your taste',
        tracks: flowTracks.map(t => ({
          id: t._id,
          title: t.title,
          artist: t.artist.name,
          artwork: t.release.artwork.cover_image,
          streams: t.songData.analytics.totalStreams
        })),
        updatedAt: new Date()
      },
      newReleases: {
        title: 'New Releases',
        items: newReleases.map(r => ({
          id: r._id,
          title: r.title,
          artist: r.artist.name,
          artwork: r.artwork.cover_image,
          releaseDate: r.dates.release_date,
          trackCount: r.tracks.length
        }))
      },
      recommendedPlaylists: {
        title: 'Playlists for You',
        items: playlists
      },
      topCharts: {
        title: 'Top Charts',
        tracks: topCharts.map((t, idx) => ({
          id: t._id,
          title: t.title,
          artist: t.artist.name,
          artwork: t.release.artwork.cover_image,
          rank: idx + 1,
          streams: t.songData.analytics.totalStreams
        }))
      },
      artistsYouMightLike: {
        title: 'Artists You Might Like',
        artists: similarArtists.map(a => ({
          id: a._id,
          name: a.name,
          image: a.imageUrl,
          genres: a.metadata?.genre || []
        }))
      },
      meta: {
        userId,
        generatedAt: new Date(),
        hasListeningHistory: userProfile.totalPlays > 0,
        selectedArtistsCount: artistIds.length
      }
    };

    return dashboard;

  } catch (error) {
    console.error('Error generating Deezer dashboard:', error);
    throw error;
  }
}

// Cluster artists (reused from previous)
async function clusterArtists(selectedFeatures, allArtists, k = 5) {
  const artistFeatures = await Promise.all(allArtists.map(artist => extractArtistsFeatures([artist._id])));
  const featureMatrix = artistFeatures.map(f => [
    ...Object.values(f.genreVector),
    ...Object.values(f.analytics),
    ...Object.values(f.moodVector)
  ]);
  const tensor = tf.tensor2d(featureMatrix);
  const { centroids, assignments } = await tf.kmeans(tensor, k);
  const clusterAssignments = assignments.arraySync();

  const selectedVector = [
    ...Object.values(selectedFeatures.genreVector),
    ...Object.values(selectedFeatures.analytics),
    ...Object.values(selectedFeatures.moodVector)
  ];
  const centroidSimilarities = centroids.arraySync().map(c => cosineSimilarity(selectedVector, c));
  const closestCluster = _.indexOf(centroidSimilarities, _.max(centroidSimilarities));

  return allArtists.filter((_, idx) => clusterAssignments[idx] === closestCluster).slice(0, 5);
}

// Normalize vector
function normalizeVector(freq) {
  const total = _.sum(Object.values(freq));
  return Object.fromEntries(Object.entries(freq).map(([k, v]) => [k, total ? v / total : 0]));
}


module.exports = { generateDeezerDashboard };
