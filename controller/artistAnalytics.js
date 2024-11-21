const Release = require("../models/releases.model");
const Track = require("../models/track.model");
const Song = require("../models/song.model");
const { default: mongoose } = require("mongoose");

const getArtistAnalytics = async (req, res) => {
  try {
    const { artistId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case '180d': startDate.setDate(endDate.getDate() - 180); break;
      case '1y': startDate.setDate(endDate.getDate() - 365); break;
      case 'all': startDate.setDate(endDate.getDate() - 3650); break; // 10 years back
    }

    // Aggregate all release analytics
    const releaseAnalytics = await Release.aggregate([
      {
        $match: {
          artistId: new mongoose.Types.ObjectId(artistId)
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "releaseId",
          as: "tracks"
        }
      },
      {
        $lookup: {
          from: "songs",
          localField: "tracks.songId",
          foreignField: "_id",
          as: "songs"
        }
      },
      {
        $addFields: {
          recentStreams: {
            $size: {
              $filter: {
                input: {
                  $reduce: {
                    input: "$songs.streamHistory",
                    initialValue: [],
                    in: { $concatArrays: ["$$value", "$$this"] }
                  }
                },
                cond: {
                  $and: [
                    { $gte: ["$$this.timestamp", startDate] },
                    { $lte: ["$$this.timestamp", endDate] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalReleases: { $sum: 1 },
          releasesByType: {
            $push: {
              type: "$type",
              count: 1
            }
          },
          totalTracks: { $sum: { $size: "$tracks" } },
          totalStreams: { $sum: "$analytics.totalStreams" },
          recentStreams: { $sum: "$recentStreams" },
          totalSaves: { $sum: "$analytics.saves" },
          totalShares: { $sum: "$analytics.shares.total" },
          totalPlaylists: { $sum: "$analytics.playlists.total" },
          editorialPlaylists: { $sum: "$analytics.playlists.editorial" },
          userPlaylists: { $sum: "$analytics.playlists.user" },
          releases: {
            $push: {
              _id: "$_id",
              title: "$title",
              type: "$type",
              releaseDate: "$dates.release_date",
              streams: "$analytics.totalStreams",
              recentStreams: "$recentStreams",
              saves: "$analytics.saves"
            }
          }
        }
      },
      {
        $addFields: {
          releasesByType: {
            $reduce: {
              input: "$releasesByType",
              initialValue: {
                single: 0,
                ep: 0,
                album: 0,
                compilation: 0
              },
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $let: {
                      vars: { type: "$$this.type" },
                      in: { "$$type": { $add: ["$$value.$$type", 1] } }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // Get detailed streaming analytics
    const streamingAnalytics = await Song.aggregate([
      {
        $match: {
          "streamHistory": {
            $elemMatch: {
              timestamp: { $gte: startDate, $lte: endDate }
            }
          }
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "songId",
          as: "track"
        }
      },
      {
        $unwind: "$track"
      },
      {
        $match: {
          "track.artistId": new mongoose.Types.ObjectId(artistId)
        }
      },
      {
        $group: {
          _id: null,
          uniqueListeners: {
            $addToSet: "$streamHistory.userId"
          },
          streamsByRegion: {
            $push: "$streamHistory.region"
          },
          streamsByDevice: {
            $push: "$streamHistory.deviceType"
          },
          avgCompletionRate: {
            $avg: "$streamHistory.completionRate"
          },
          peakStreams: {
            $max: {
              $size: {
                $filter: {
                  input: "$streamHistory",
                  cond: {
                    $and: [
                      { $gte: ["$$this.timestamp", startDate] },
                      { $lte: ["$$this.timestamp", endDate] }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          uniqueListeners: { $size: "$uniqueListeners" },
          avgCompletionRate: { $multiply: ["$avgCompletionRate", 100] },
          peakStreams: 1,
          regionBreakdown: {
            $reduce: {
              input: "$streamsByRegion",
              initialValue: {},
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $let: {
                      vars: { region: "$$this" },
                      in: {
                        "$$region": {
                          $add: [{ $ifNull: ["$$value.$$region", 0] }, 1]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
          deviceBreakdown: {
            $reduce: {
              input: "$streamsByDevice",
              initialValue: {},
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $let: {
                      vars: { device: "$$this" },
                      in: {
                        "$$device": {
                          $add: [{ $ifNull: ["$$value.$$device", 0] }, 1]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // Get top performing releases
    const topReleases = await Release.aggregate([
      {
        $match: {
          artistId: new mongoose.Types.ObjectId(artistId)
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$analytics.totalStreams", 1] },
              { $multiply: ["$analytics.saves", 2] },
              { $multiply: ["$analytics.shares.total", 3] },
              { $multiply: ["$analytics.playlists.total", 4] }
            ]
          }
        }
      },
      {
        $sort: { score: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          releaseDate: "$dates.release_date",
          artwork: "$artwork.cover_image",
          analytics: {
            streams: "$analytics.totalStreams",
            saves: "$analytics.saves",
            shares: "$analytics.shares.total",
            playlists: "$analytics.playlists.total"
          },
          score: 1
        }
      }
    ]);

    const analytics = releaseAnalytics[0] || {
      totalReleases: 0,
      releasesByType: { single: 0, ep: 0, album: 0, compilation: 0 },
      totalTracks: 0,
      totalStreams: 0,
      recentStreams: 0,
      totalSaves: 0,
      totalShares: 0,
      totalPlaylists: 0,
      editorialPlaylists: 0,
      userPlaylists: 0,
      releases: []
    };

    const streaming = streamingAnalytics[0] || {
      uniqueListeners: 0,
      avgCompletionRate: 0,
      peakStreams: 0,
      regionBreakdown: {},
      deviceBreakdown: {}
    };

    // Calculate growth metrics
    const growth = {
      streams: analytics.recentStreams > 0
        ? ((analytics.recentStreams / analytics.totalStreams) * 100).toFixed(2)
        : 0,
      playlists: analytics.totalPlaylists > 0
        ? (((analytics.editorialPlaylists + analytics.userPlaylists) / analytics.totalPlaylists) * 100).toFixed(2)
        : 0
    };

    return res.status(200).json({
      message: "Successfully retrieved artist analytics",
      data: {
        overview: {
          totalReleases: analytics.totalReleases,
          releasesByType: analytics.releasesByType,
          totalTracks: analytics.totalTracks,
          totalStreams: analytics.totalStreams,
          recentStreams: analytics.recentStreams,
          growth: growth
        },
        engagement: {
          saves: analytics.totalSaves,
          shares: analytics.totalShares,
          playlists: {
            total: analytics.totalPlaylists,
            editorial: analytics.editorialPlaylists,
            user: analytics.userPlaylists
          }
        },
        streaming: {
          uniqueListeners: streaming.uniqueListeners,
          avgCompletionRate: streaming.avgCompletionRate,
          peakStreams: streaming.peakStreams,
          regionBreakdown: streaming.regionBreakdown,
          deviceBreakdown: streaming.deviceBreakdown
        },
        topReleases,
        recentReleases: analytics.releases
          .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
          .slice(0, 5)
      },
      meta: {
        timeframe,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error("Error in getArtistAnalytics:", error);
    return res.status(500).json({
      message: "Error fetching artist analytics",
      error: error.message
    });
  }
};

const getArtistCatalog = async (req, res) => {
    try {
      const { artistId } = req.params;
      const {
        type, // 'all', 'album', 'ep', 'single', 'compilation'
        sort = 'recent', // 'recent', 'popular', 'alphabetical'
        year,
        genre,
        page = 1,
        limit = 20,
        include_features = 'true', // Include tracks where artist is featured
        groupBy = 'release_type' // 'release_type', 'year', 'none'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build match conditions
      const matchStage = {
        $or: [
          { artistId: new mongoose.Types.ObjectId(artistId) }
        ]
      };

      // Include featured tracks if requested
      if (include_features === 'true') {
        matchStage.$or.push({
          'features.artistId': new mongoose.Types.ObjectId(artistId)
        });
      }

      // Filter by release type
      if (type && type !== 'all') {
        matchStage.type = type;
      }

      // Filter by year
      if (year) {
        matchStage['dates.release_date'] = {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        };
      }

      // Filter by genre
      if (genre) {
        matchStage['metadata.genre'] = genre;
      }

      // Sort configurations
      const sortOptions = {
        recent: { 'dates.release_date': -1 },
        oldest: { 'dates.release_date': 1 },
        popular: { 'analytics.totalStreams': -1 },
        alphabetical: { title: 1 }
      };

      // Base aggregation pipeline
      const basePipeline = [
        {
          $match: matchStage
        },
        // Lookup tracks
        {
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "releaseId",
            as: "tracks"
          }
        },
        // Lookup songs
        {
          $lookup: {
            from: "songs",
            let: { trackIds: "$tracks.songId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$trackIds"]
                  }
                }
              }
            ],
            as: "songs"
          }
        },
        // Lookup featured artists for tracks
        {
          $lookup: {
            from: "ft",
            let: { trackIds: "$tracks._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$trackId", "$$trackIds"]
                  }
                }
              },
              {
                $lookup: {
                  from: "artists",
                  localField: "artistId",
                  foreignField: "_id",
                  as: "artist"
                }
              }
            ],
            as: "features"
          }
        },
        // Add computed fields
        {
          $addFields: {
            totalTracks: { $size: "$tracks" },
            totalDuration: {
              $reduce: {
                input: "$tracks",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.duration"] }
              }
            },
            yearReleased: { $year: "$dates.release_date" },
            popularityScore: {
              $add: [
                { $multiply: ["$analytics.totalStreams", 1] },
                { $multiply: ["$analytics.saves", 2] },
                { $multiply: ["$analytics.shares.total", 3] },
                { $multiply: ["$analytics.playlists.total", 4] }
              ]
            }
          }
        }
      ];

      // Group releases based on groupBy parameter
      let groupPipeline = [];
      if (groupBy === 'release_type') {
        groupPipeline = [
          {
            $group: {
              _id: "$type",
              releases: { $push: "$$ROOT" },
              count: { $sum: 1 },
              totalStreams: { $sum: "$analytics.totalStreams" }
            }
          }
        ];
      } else if (groupBy === 'year') {
        groupPipeline = [
          {
            $group: {
              _id: "$yearReleased",
              releases: { $push: "$$ROOT" },
              count: { $sum: 1 },
              totalStreams: { $sum: "$analytics.totalStreams" }
            }
          },
          { $sort: { _id: -1 } }
        ];
      }

      // Project final shape
      const projectStage = {
        $project: {
          _id: 1,
          title: 1,
          type: 1,
          artwork: "$artwork.cover_image",
          releaseDate: "$dates.release_date",
          metadata: {
            genre: "$metadata.genre",
            totalTracks: "$totalTracks",
            duration: "$totalDuration",
            language: "$metadata.language"
          },
          commercial: {
            label: "$commercial.label",
            distributors: "$commercial.distributors"
          },
          tracks: {
            $map: {
              input: "$tracks",
              as: "track",
              in: {
                _id: "$$track._id",
                title: "$$track.title",
                duration: "$$track.duration",
                trackNumber: "$$track.track_number",
                isExplicit: "$$track.flags.isExplicit",
                features: {
                  $filter: {
                    input: "$features",
                    as: "feature",
                    cond: { $eq: ["$$feature.trackId", "$$track._id"] }
                  }
                }
              }
            }
          },
          analytics: {
            streams: "$analytics.totalStreams",
            saves: "$analytics.saves",
            shares: "$analytics.shares.total",
            playlists: {
              total: "$analytics.playlists.total",
              editorial: "$analytics.playlists.editorial",
              user: "$analytics.playlists.user"
            }
          },
          popularityScore: 1
        }
      };

      // Execute base query to get total count
      const totalCount = await Release.countDocuments(matchStage);

      // Execute main query
      let pipeline = [...basePipeline];

      // Add sorting
      pipeline.push({ $sort: sortOptions[sort] || sortOptions.recent });

      // Add grouping if specified
      if (groupBy !== 'none') {
        pipeline = [...pipeline, ...groupPipeline];
      } else {
        // Add pagination for ungrouped results
        pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });
      }

      // Add projection
      pipeline.push(projectStage);

      const results = await Release.aggregate(pipeline);

      // Get artist's featured tracks separately
      let featuredTracks = [];
      if (include_features === 'true') {
        featuredTracks = await Track.aggregate([
          {
            $lookup: {
              from: "ft",
              localField: "_id",
              foreignField: "trackId",
              as: "features"
            }
          },
          {
            $match: {
              "features.artistId": new mongoose.Types.ObjectId(artistId),
              artistId: { $ne: new mongoose.Types.ObjectId(artistId) } // Exclude tracks where artist is primary
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
              as: "primaryArtist"
            }
          },
          {
            $unwind: "$primaryArtist"
          },
          {
            $project: {
              _id: 1,
              title: 1,
              duration: 1,
              releaseDate: "$release.dates.release_date",
              release: {
                _id: "$release._id",
                title: "$release.title",
                type: "$release.type",
                artwork: "$release.artwork.cover_image"
              },
              primaryArtist: {
                _id: "$primaryArtist._id",
                name: "$primaryArtist.name"
              },
              contribution: {
                $arrayElemAt: ["$features.contribution", 0]
              }
            }
          },
          { $sort: { releaseDate: -1 } }
        ]);
      }

      // Calculate additional statistics
      const stats = {
        totalReleases: totalCount,
        totalTracks: results.reduce((sum, item) => {
          const releases = item.releases || [item];
          return sum + releases.reduce((trackSum, release) => trackSum + release.metadata.totalTracks, 0);
        }, 0),
        totalFeatures: featuredTracks.length,
        releasesByType: results.reduce((acc, item) => {
          if (groupBy === 'release_type') {
            acc[item._id] = item.count;
          } else {
            const releases = item.releases || [item];
            releases.forEach(release => {
              acc[release.type] = (acc[release.type] || 0) + 1;
            });
          }
          return acc;
        }, {}),
        yearRange: {
          earliest: null,
          latest: null
        }
      };

      // Find year range
      results.forEach(item => {
        const releases = item.releases || [item];
        releases.forEach(release => {
          const releaseDate = new Date(release.releaseDate);
          if (!stats.yearRange.earliest || releaseDate < new Date(stats.yearRange.earliest)) {
            stats.yearRange.earliest = releaseDate;
          }
          if (!stats.yearRange.latest || releaseDate > new Date(stats.yearRange.latest)) {
            stats.yearRange.latest = releaseDate;
          }
        });
      });

      return res.status(200).json({
        message: "Successfully retrieved artist catalog",
        data: {
          releases: results,
          featuredTracks: include_features === 'true' ? featuredTracks : undefined,
          stats
        },
        pagination: groupBy === 'none' ? {
          current: parseInt(page),
          total: Math.ceil(totalCount / parseInt(limit)),
          hasMore: totalCount > (skip + parseInt(limit))
        } : undefined,
        meta: {
          groupedBy: groupBy,
          sortedBy: sort,
          filters: {
            type,
            year,
            genre,
            include_features
          }
        }
      });

    } catch (error) {
      console.error("Error in getArtistCatalog:", error);
      return res.status(500).json({
        message: "Error fetching artist catalog",
        error: error.message
      });
    }
  };

  const getArtistActiveListeners = async (req, res) => {
    try {
      const { artistId } = req.params;
      const {
        timeWindow = '5m', // 5m, 15m, 30m, 1h, 24h
        includeDetails = 'false'
      } = req.query;

      // Calculate time window
      const now = new Date();
      const windowStart = new Date();
      switch (timeWindow) {
        case '5m': windowStart.setMinutes(now.getMinutes() - 5); break;
        case '15m': windowStart.setMinutes(now.getMinutes() - 15); break;
        case '30m': windowStart.setMinutes(now.getMinutes() - 30); break;
        case '1h': windowStart.setHours(now.getHours() - 1); break;
        case '24h': windowStart.setHours(now.getHours() - 24); break;
        default: windowStart.setMinutes(now.getMinutes() - 5);
      }

      // Base pipeline for active listeners
      const basePipeline = [
        {
          $match: {
            "streamHistory": {
              $elemMatch: {
                timestamp: { $gte: windowStart, $lte: now }
              }
            }
          }
        },
        {
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "songId",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        {
          $match: {
            "track.artistId": new mongoose.Types.ObjectId(artistId)
          }
        }
      ];

      // Get current active listeners count and details
      const activeListeners = await Song.aggregate([
        ...basePipeline,
        {
          $project: {
            streamHistory: {
              $filter: {
                input: "$streamHistory",
                as: "stream",
                cond: {
                  $and: [
                    { $gte: ["$$stream.timestamp", windowStart] },
                    { $lte: ["$$stream.timestamp", now] }
                  ]
                }
              }
            },
            trackId: "$track._id",
            trackTitle: "$track.title"
          }
        },
        {
          $unwind: "$streamHistory"
        },
        {
          $group: {
            _id: null,
            uniqueListeners: { $addToSet: "$streamHistory.userId" },
            totalStreams: { $sum: 1 },
            activeRegions: { $addToSet: "$streamHistory.region" },
            deviceTypes: { $addToSet: "$streamHistory.deviceType" },
            activeTracks: {
              $addToSet: {
                trackId: "$trackId",
                title: "$trackTitle"
              }
            },
            streamHistory: {
              $push: {
                timestamp: "$streamHistory.timestamp",
                region: "$streamHistory.region",
                deviceType: "$streamHistory.deviceType",
                quality: "$streamHistory.quality"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            currentListeners: { $size: "$uniqueListeners" },
            totalStreams: 1,
            uniqueRegions: { $size: "$activeRegions" },
            activeRegions: 1,
            deviceTypes: 1,
            activeTracks: { $size: "$activeTracks" },
            tracks: "$activeTracks",
            streamHistory: {
              $cond: [
                { $eq: [includeDetails, 'true'] },
                "$streamHistory",
                "$$REMOVE"
              ]
            }
          }
        }
      ]);

      // Get trending metrics
      const trendingMetrics = await Song.aggregate([
        ...basePipeline,
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
            streamHistory: {
              $filter: {
                input: "$streamHistory",
                as: "stream",
                cond: {
                  $and: [
                    { $gte: ["$$stream.timestamp", windowStart] },
                    { $lte: ["$$stream.timestamp", now] }
                  ]
                }
              }
            },
            track: {
              _id: "$track._id",
              title: "$track.title",
              release: {
                _id: "$release._id",
                title: "$release.title",
                artwork: "$release.artwork.cover_image"
              }
            }
          }
        },
        {
          $unwind: "$streamHistory"
        },
        {
          $group: {
            _id: "$track._id",
            track: { $first: "$track" },
            listeners: { $addToSet: "$streamHistory.userId" },
            streams: { $sum: 1 },
            regions: { $addToSet: "$streamHistory.region" }
          }
        },
        {
          $project: {
            _id: 0,
            track: 1,
            currentListeners: { $size: "$listeners" },
            streams: 1,
            regionCount: { $size: "$regions" }
          }
        },
        {
          $sort: { currentListeners: -1 }
        },
        {
          $limit: 5
        }
      ]);

      // Get listener growth trend
      const listenerTrend = await Song.aggregate([
        ...basePipeline,
        {
          $project: {
            streamHistory: {
              $filter: {
                input: "$streamHistory",
                as: "stream",
                cond: {
                  $and: [
                    { $gte: ["$$stream.timestamp", windowStart] },
                    { $lte: ["$$stream.timestamp", now] }
                  ]
                }
              }
            }
          }
        },
        {
          $unwind: "$streamHistory"
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: timeWindow === '24h' ? "%Y-%m-%d-%H" : "%Y-%m-%d-%H-%M",
                date: "$streamHistory.timestamp"
              }
            },
            listeners: { $addToSet: "$streamHistory.userId" }
          }
        },
        {
          $project: {
            _id: 1,
            listeners: { $size: "$listeners" }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      // Calculate engagement metrics
      const avgSessionDuration = await Song.aggregate([
        ...basePipeline,
        {
          $project: {
            streamHistory: {
              $filter: {
                input: "$streamHistory",
                as: "stream",
                cond: {
                  $and: [
                    { $gte: ["$$stream.timestamp", windowStart] },
                    { $lte: ["$$stream.timestamp", now] }
                  ]
                }
              }
            }
          }
        },
        {
          $unwind: "$streamHistory"
        },
        {
          $group: {
            _id: "$streamHistory.userId",
            firstStream: { $min: "$streamHistory.timestamp" },
            lastStream: { $max: "$streamHistory.timestamp" },
            totalStreams: { $sum: 1 }
          }
        },
        {
          $project: {
            sessionDuration: {
              $divide: [
                { $subtract: ["$lastStream", "$firstStream"] },
                1000 * 60 // Convert to minutes
              ]
            },
            totalStreams: 1
          }
        },
        {
          $group: {
            _id: null,
            avgSessionDuration: { $avg: "$sessionDuration" },
            avgStreamsPerUser: { $avg: "$totalStreams" }
          }
        }
      ]);

      const stats = activeListeners[0] || {
        currentListeners: 0,
        totalStreams: 0,
        uniqueRegions: 0,
        activeRegions: [],
        deviceTypes: [],
        activeTracks: 0
      };

      const engagement = avgSessionDuration[0] || {
        avgSessionDuration: 0,
        avgStreamsPerUser: 0
      };

      return res.status(200).json({
        message: "Successfully retrieved artist's active listeners",
        data: {
          currentStatus: {
            timestamp: new Date(),
            activeListeners: stats.currentListeners,
            streams: stats.totalStreams,
            activeTracks: stats.activeTracks
          },
          geographic: {
            uniqueRegions: stats.uniqueRegions,
            activeRegions: stats.activeRegions.reduce((acc, region) => {
              acc[region] = (acc[region] || 0) + 1;
              return acc;
            }, {})
          },
          devices: stats.deviceTypes.reduce((acc, device) => {
            acc[device] = (acc[device] || 0) + 1;
            return acc;
          }, {}),
          trending: {
            topTracks: trendingMetrics,
            listenerTrend: listenerTrend
          },
          engagement: {
            avgSessionDuration: engagement.avgSessionDuration.toFixed(2),
            avgStreamsPerUser: engagement.avgStreamsPerUser.toFixed(2)
          }
        },
        meta: {
          timeWindow,
          includeDetails: includeDetails === 'true',
          startTime: windowStart,
          endTime: now
        }
      });

    } catch (error) {
      console.error("Error in getArtistActiveListeners:", error);
      return res.status(500).json({
        message: "Error fetching artist's active listeners",
        error: error.message
      });
    }
  };

  module.exports = {}
