const Song = require("../models/song.model");
const Release = require("../models/releases.model");
const Track = require("../models/track.model");
const Genre = require("../models/genre.model");
const Artist = require("../models/artist.model");
const Follow = require("../models/followers.model");
const LastPlayed = require("../models/lastplayed.model");
const LikeTracks = require("../models/liketracks.model");
const Playlist = require("../models/playlistnames.model");
const { default: mongoose } = require("mongoose");

// Get overall dashboard data
const getDashboardOverview = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get recent activity counts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Aggregate user's listening stats
    const listeningStats = await LastPlayed.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $facet: {
          monthlyStats: [
            {
              $group: {
                _id: null,
                totalStreams: { $sum: 1 },
                uniqueTracks: { $addToSet: "$trackId" },
                totalDuration: { $sum: "$duration" },
                avgCompletionRate: { $avg: "$completionRate" }
              }
            }
          ],
          weeklyStats: [
            {
              $match: {
                timestamp: { $gte: sevenDaysAgo }
              }
            },
            {
              $group: {
                _id: null,
                totalStreams: { $sum: 1 },
                uniqueTracks: { $addToSet: "$trackId" }
              }
            }
          ],
          deviceBreakdown: [
            {
              $group: {
                _id: "$deviceType",
                count: { $sum: 1 }
              }
            }
          ],
          dailyActivity: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                streams: { $sum: 1 }
              }
            },
            { $sort: { "_id": 1 } }
          ]
        }
      }
    ]);

    // Get user's top genres
    const topGenres = await LastPlayed.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track"
        }
      },
      {
        $unwind: "$track"
      },
      {
        $unwind: "$track.metadata.genre"
      },
      {
        $group: {
          _id: "$track.metadata.genre",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Get quick stats
    const quickStats = {
      followedArtists: await Follow.countDocuments({ userId }),
      savedReleases: await SavedRelease.countDocuments({ userId }),
      likedTracks: await LikeTracks.countDocuments({ userId }),
      playlists: await Playlist.countDocuments({ userId })
    };

    return res.status(200).json({
      message: "Successfully retrieved dashboard overview",
      data: {
        listeningStats: listeningStats[0],
        topGenres,
        quickStats,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching dashboard overview",
      error: error.message
    });
  }
};

// Get personalized recommendations
const getDashboardRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    // Get user's recent listening history (last 30 days)
    const recentHistory = await LastPlayed.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track"
        }
      },
      {
        $unwind: "$track"
      }
    ]);

    // Extract favorite genres and artists
    const favoriteGenres = recentHistory.reduce((genres, item) => {
      if (item.track.metadata.genre) {
        item.track.metadata.genre.forEach(genre => {
          genres[genre] = (genres[genre] || 0) + 1;
        });
      }
      return genres;
    }, {});

    const favoriteArtists = recentHistory.reduce((artists, item) => {
      const artistId = item.track.artistId.toString();
      artists[artistId] = (artists[artistId] || 0) + 1;
      return artists;
    }, {});

    // Get top genres and artists
    const topGenres = Object.entries(favoriteGenres)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre]) => genre);

    const topArtistIds = Object.entries(favoriteArtists)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([artistId]) => new mongoose.Types.ObjectId(artistId));

    // Get recommendations
    const recommendations = await Track.aggregate([
      {
        $match: {
          $or: [
            { "metadata.genre": { $in: topGenres } },
            { artistId: { $in: topArtistIds } }
          ],
          _id: {
            $nin: recentHistory.map(item => item.trackId)
          }
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release"
        }
      },
      {
        $unwind: "$release"
      },
      {
        $lookup: {
          from: "artists",
          localField: "artistId",
          foreignField: "_id",
          as: "artist"
        }
      },
      {
        $unwind: "$artist"
      },
      {
        $addFields: {
          recommendationScore: {
            $add: [
              {
                $cond: {
                  if: { $in: [{ $arrayElemAt: ["$metadata.genre", 0] }, topGenres] },
                  then: 5,
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $in: ["$artistId", topArtistIds] },
                  then: 3,
                  else: 0
                }
              },
              {
                $cond: {
                  if: {
                    $gte: [
                      "$release.dates.release_date",
                      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                    ]
                  },
                  then: 2,
                  else: 0
                }
              }
            ]
          }
        }
      },
      {
        $sort: { recommendationScore: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          title: 1,
          duration: 1,
          artist: {
            _id: "$artist._id",
            name: "$artist.name",
            image: "$artist.profileImage"
          },
          release: {
            _id: "$release._id",
            title: "$release.title",
            artwork: "$release.artwork.cover_image",
            type: "$release.type"
          },
          metadata: {
            genre: 1,
            isrc: 1
          },
          recommendationScore: 1,
          recommendationReason: {
            $cond: {
              if: { $in: ["$artistId", topArtistIds] },
              then: "Based on artists you like",
              else: "Based on your favorite genres"
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved dashboard recommendations",
      data: recommendations
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching dashboard recommendations",
      error: error.message
    });
  }
};

// Get weekly discovery playlist
const getWeeklyDiscovery = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;

    // Get user's listening history and preferences
    const userHistory = await LastPlayed.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track"
        }
      },
      {
        $unwind: "$track"
      }
    ]);

    // Get listened track IDs to exclude
    const listenedTrackIds = userHistory.map(item => item.trackId);

    // Get user's preferred genres and moods
    const preferredGenres = [...new Set(userHistory
      .flatMap(item => item.track.metadata.genre || []))];

    // Find similar tracks based on user preferences
    const discoveryTracks = await Track.aggregate([
      {
        $match: {
          _id: { $nin: listenedTrackIds },
          "metadata.genre": { $in: preferredGenres }
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release"
        }
      },
      {
        $unwind: "$release"
      },
      {
        $lookup: {
          from: "artists",
          localField: "artistId",
          foreignField: "_id",
          as: "artist"
        }
      },
      {
        $unwind: "$artist"
      },
      {
        $sample: { size: parseInt(limit) }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          duration: 1,
          artist: {
            _id: "$artist._id",
            name: "$artist.name",
            image: "$artist.profileImage"
          },
          release: {
            _id: "$release._id",
            title: "$release.title",
            artwork: "$release.artwork.cover_image",
            type: "$release.type"
          },
          metadata: {
            genre: 1,
            mood: 1
          }
        }
      }
    ]);

    return res.status(200).json({
      message: "Successfully generated weekly discovery playlist",
      data: {
        name: "Your Weekly Discovery",
        description: "New music picked for you based on your tastes",
        tracks: discoveryTracks,
        refreshDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error generating weekly discovery",
      error: error.message
    });
  }
};

// Get recent activity feed
const getActivityFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's recent activity (likes, saves, follows, etc.)
    const recentActivity = await Promise.all([
      // Get liked tracks
      LikeTracks.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $lookup: {
            from: "tracks",
            localField: "trackId",
            foreignField: "_id",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        {
          $lookup: {
            from: "releases",
            localField: "track.releaseId",
            foreignField: "_id",
            as: "release"
          }
        },
        {
          $unwind: "$release"
        },
        {
          $project: {
            type: "like",
            timestamp: "$timestamp",
            content: {
              trackId: "$track._id",
              title: "$track.title",
              release: "$release.title",
              artwork: "$release.artwork.cover_image"
            }
          }
        }
      ]),

      // Get followed artists
      Follow.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $unwind: "$artist"
        },
        {
          $project: {
            type: "follow",
            timestamp: "$timestamp",
            content: {
              artistId: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            }
          }
        }
      ]),

      // Get playlist activities
      Playlist.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $project: {
            type: "playlist",
            timestamp: "$createdAt",
            content: {
              playlistId: "$_id",
              name: "$name",
              trackCount: { $size: "$tracks" }
            }
          }
        }
      ])
    ]);

    // Combine and sort all activities
    const allActivities = recentActivity
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(skip, skip + parseInt(limit));

    const total = recentActivity.flat().length;

    return res.status(200).json({
      message: "Successfully retrieved activity feed",
      data: allActivities,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: total > (skip + allActivities.length)
      }
    });

  } catch (error) {
    return res.status(500).json({
        message: "Error fetching activity feed",
        error: error.message
      });
    }
  };

  // Get user's listening habits
  const getListeningHabits = async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeframe = '30d' } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeframe) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case '180d': startDate.setDate(endDate.getDate() - 180); break;
      }

      const listeningHabits = await LastPlayed.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $facet: {
            // Time of day analysis
            timeOfDay: [
              {
                $group: {
                  _id: { $hour: "$timestamp" },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            // Day of week analysis
            dayOfWeek: [
              {
                $group: {
                  _id: { $dayOfWeek: "$timestamp" },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            // Session analysis (gaps > 30 min = new session)
            sessions: [
              { $sort: { timestamp: 1 } },
              {
                $group: {
                  _id: {
                    $subtract: [
                      { $subtract: ["$timestamp", new Date("1970-01-01")] },
                      {
                        $mod: [
                          { $subtract: ["$timestamp", new Date("1970-01-01")] },
                          1800000 // 30 minutes in milliseconds
                        ]
                      }
                    ]
                  },
                  duration: {
                    $sum: "$duration"
                  },
                  tracks: { $sum: 1 }
                }
              },
              {
                $group: {
                  _id: null,
                  averageSessionDuration: { $avg: "$duration" },
                  averageTracksPerSession: { $avg: "$tracks" },
                  totalSessions: { $sum: 1 }
                }
              }
            ],
            // Device usage
            devices: [
              {
                $group: {
                  _id: "$deviceType",
                  count: { $sum: 1 },
                  duration: { $sum: "$duration" }
                }
              }
            ],
            // Audio quality preferences
            qualityPreferences: [
              {
                $group: {
                  _id: "$quality",
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]);

      return res.status(200).json({
        message: "Successfully retrieved listening habits",
        data: {
          timeframe,
          habits: listeningHabits[0]
        }
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching listening habits",
        error: error.message
      });
    }
  };

  // Get personalized charts
  const getPersonalizedCharts = async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeframe = '7d' } = req.query;

      const endDate = new Date();
      const startDate = new Date();
      switch (timeframe) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
      }

      // Get user's top tracks
      const topTracks = await LastPlayed.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$trackId",
            playCount: { $sum: 1 },
            lastPlayed: { $max: "$timestamp" },
            avgCompletion: { $avg: "$completionRate" }
          }
        },
        {
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "_id",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        {
          $lookup: {
            from: "releases",
            localField: "track.releaseId",
            foreignField: "_id",
            as: "release"
          }
        },
        {
          $unwind: "$release"
        },
        {
          $lookup: {
            from: "artists",
            localField: "track.artistId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $unwind: "$artist"
        },
        {
          $sort: { playCount: -1 }
        },
        {
          $limit: 50
        }
      ]);

      // Get user's top artists
      const topArtists = await LastPlayed.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: "tracks",
            localField: "trackId",
            foreignField: "_id",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        {
          $group: {
            _id: "$track.artistId",
            playCount: { $sum: 1 },
            tracks: { $addToSet: "$track._id" }
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "_id",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $unwind: "$artist"
        },
        {
          $project: {
            _id: 1,
            name: "$artist.name",
            image: "$artist.profileImage",
            playCount: 1,
            uniqueTracks: { $size: "$tracks" }
          }
        },
        {
          $sort: { playCount: -1 }
        },
        {
          $limit: 20
        }
      ]);

      // Get genre distribution
      const genreDistribution = await LastPlayed.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: "tracks",
            localField: "trackId",
            foreignField: "_id",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        {
          $unwind: "$track.metadata.genre"
        },
        {
          $group: {
            _id: "$track.metadata.genre",
            count: { $sum: 1 },
            duration: { $sum: "$duration" }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return res.status(200).json({
        message: "Successfully retrieved personalized charts",
        data: {
          timeframe,
          charts: {
            topTracks,
            topArtists,
            genreDistribution
          }
        }
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching personalized charts",
        error: error.message
      });
    }
  };

  // Get mood-based recommendations
  const getMoodBasedRecommendations = async (req, res) => {
    try {
      const { userId } = req.params;
      const { mood, limit = 20 } = req.query;

      // If mood is not provided, analyze user's recent listening to determine current mood
      let targetMood = mood;
      if (!targetMood) {
        const recentListening = await LastPlayed.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          },
          {
            $lookup: {
              from: "tracks",
              localField: "trackId",
              foreignField: "_id",
              as: "track"
            }
          },
          {
            $unwind: "$track"
          },
          {
            $group: {
              _id: "$track.metadata.mood",
              count: { $sum: 1 }
            }
          },
          {
            $sort: { count: -1 }
          },
          {
            $limit: 1
          }
        ]);

        targetMood = recentListening[0]?._id || 'energetic';
      }

      // Get recommendations based on mood
      const recommendations = await Track.aggregate([
        {
          $match: {
            "metadata.mood": targetMood,
            // Exclude recently played tracks
            _id: {
              $nin: await LastPlayed.distinct('trackId', {
                userId: new mongoose.Types.ObjectId(userId),
                timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              })
            }
          }
        },
        {
          $lookup: {
            from: "releases",
            localField: "releaseId",
            foreignField: "_id",
            as: "release"
          }
        },
        {
          $unwind: "$release"
        },
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $unwind: "$artist"
        },
        {
          $sample: { size: parseInt(limit) }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            duration: 1,
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            release: {
              _id: "$release._id",
              title: "$release.title",
              artwork: "$release.artwork.cover_image"
            },
            mood: "$metadata.mood"
          }
        }
      ]);

      return res.status(200).json({
        message: "Successfully retrieved mood-based recommendations",
        data: {
          mood: targetMood,
          recommendations,
          description: `Music to match your ${targetMood} mood`
        }
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching mood-based recommendations",
        error: error.message
      });
    }
  };

  module.exports = {
    getDashboardOverview,
    getDashboardRecommendations,
    getWeeklyDiscovery,
    getActivityFeed,
    getListeningHabits,
    getPersonalizedCharts,
    getMoodBasedRecommendations
  };
