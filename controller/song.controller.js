const Song = require("../models/song.model");
const Release = require("../models/releases.model");
const Track = require("../models/track.model");
const Genre = require("../models/genre.model");
const Artist = require("../models/artist.model");
const Follow = require("../models/followers.model");
const LastPlayed = require("../models/lastplayed.model");
const FT = require("../models/ft.model");
const SavedRelease = require("../models/savedalbums.model");
const LikeTracks = require("../models/liketracks.model");
const { matchUser } = require("../utils/helpers/searchquery");
const { default: mongoose } = require("mongoose");

// Common aggregation pipelines
const releaseDetailsPipeline = [
  {
    $lookup: {
      from: "tracks",
      localField: "_id",
      foreignField: "releaseId",
      as: "tracklists",
    },
  },
  {
    $unwind: { path: "$tracklists", preserveNullAndEmptyArrays: true },
  },
  {
    $lookup: {
      from: "songs",
      localField: "tracklists.songId",
      foreignField: "_id",
      as: "tracklists.song",
    },
  },
  {
    $unwind: {
      path: "$tracklists.song",
      preserveNullAndEmptyArrays: true,
    },
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
    $unwind: {
      path: "$artist",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $group: {
      _id: "$_id",
      tracklists: { $push: "$tracklists" },
      artist: { $first: "$artist" },
      otherFields: { $first: "$$ROOT" },
    },
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: ["$otherFields", { tracklists: "$tracklists", artist: "$artist" }],
      },
    },
  },
];

// Basic CRUD Operations
const getAllSongs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const songs = await Song.aggregate([
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "songId",
          as: "trackInfo"
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackInfo.releaseId",
          foreignField: "_id",
          as: "releaseInfo"
        }
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ["$analytics.totalStreams", 1] },
              { $multiply: ["$analytics.playlistAdditions", 2] },
              { $multiply: ["$analytics.shares.total", 3] },
              { $multiply: ["$analytics.likes", 1.5] }
            ]
          }
        }
      },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const total = await Song.countDocuments();

    return res.status(200).json({
      message: "Successfully retrieved all songs",
      data: songs,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasMore: total > skip + songs.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching songs",
      error: error.message
    });
  }
};

const getSong = async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(songId)
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "songId",
          as: "trackInfo"
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackInfo.releaseId",
          foreignField: "_id",
          as: "releaseInfo"
        }
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ["$analytics.totalStreams", 1] },
              { $multiply: ["$analytics.playlistAdditions", 2] },
              { $multiply: ["$analytics.shares.total", 3] },
              { $multiply: ["$analytics.likes", 1.5] }
            ]
          }
        }
      }
    ]);

    if (!song.length) {
      return res.status(404).json({ message: "Song not found" });
    }

    return res.status(200).json({
      message: "Successfully retrieved song",
      data: song[0]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching song",
      error: error.message
    });
  }
};

// Release Management
const createRelease = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        title,
        artistId,
        type,
        release_date,
        cover_image,
        genre,
        label,
        songs,
        description,
        isExplicit,
        metadata,
      } = req.body;

      // Validate required fields
      if (!title || !artistId || !type || !release_date || !genre || !songs) {
        throw new Error("Missing required fields: title, artistId, type, release_date, genre, and songs are required");
      }

      // Validate release type constraints
      const parsedSongs = JSON.parse(JSON.stringify(songs));
      if (type === "single" && parsedSongs.length !== 1) {
        throw new Error("A single must contain exactly one song");
      }
      if (type === "album" && (parsedSongs.length < 5 || parsedSongs.length > 25)) {
        throw new Error("An album must contain between 5 and 20 songs");
      }
      if (type === "ep" && (parsedSongs.length < 2 || parsedSongs.length > 6)) {
        throw new Error("An EP must contain between 2 and 6 songs");
      }

      // Create release
      const release = new Release({
        title,
        artistId,
        type,
        dates: {
          release_date: new Date(release_date),
          announcement_date: new Date(),
        },
        artwork: {
          cover_image: {
            high: cover_image,
            medium: cover_image,
            low: cover_image,
            thumbnail: cover_image
          },
          colorPalette: [],
        },
        metadata: {
          genre: Array.isArray(genre) ? genre : [genre],
          totalTracks: parsedSongs.length,
          ...metadata
        },
        commercial: {
          label,
        },
        description: {
          main: description
        },
        contentInfo: {
          isExplicit
        }
      });

      // Validate each song's required fields before processing
      for (const songData of parsedSongs) {
        if (!songData.fileUrl || !songData.duration || !songData.bitrate || !songData.title) {
          throw new Error(
            `Invalid song data. Each song requires: fileUrl, duration, bitrate, and title.
             Missing fields in song: ${songData.title || 'Untitled'}`
          );
        }
      }

      const songsToSave = [];
      const tracksToSave = [];
      const featuredArtists = [];

      // Process each song
      for (let i = 0; i < parsedSongs.length; i++) {
        const songData = parsedSongs[i];

        // Create song with all required fields
        const song = new Song({
          fileUrl: songData.fileUrl,
          duration: songData.duration,
          bitrate: songData.bitrate,
          format: songData.format || 'mp3',
          analytics: {
            totalStreams: 0,
            uniqueListeners: 0,
            playlistAdditions: 0,
            shares: {
              total: 0,
              platforms: {}
            }
          },
          flags: {
            isExplicit: songData.isExplicit || false,
            isInstrumental: songData.isInstrumental || false,
            hasLyrics: songData.hasLyrics !== false
          }
        });
        songsToSave.push(song);

        // Create track
        const track = new Track({
          releaseId: release._id,
          songId: song._id,
          title: songData.title,
          duration: songData.duration,
          track_number: i + 1,
          artistId,
          metadata: {
            genre: Array.isArray(genre) ? genre : [genre],
            bpm: songData.bpm,
            key: songData.key,
            languageCode: songData.language,
            isrc: songData.isrc
          },
          flags: {
            isExplicit: songData.isExplicit || false,
            isInstrumental: songData.isInstrumental || false,
            hasLyrics: songData.hasLyrics !== false
          }
        });
        tracksToSave.push(track);

        // Process featured artists if present
        if (Array.isArray(songData.featuredArtists) && songData.featuredArtists.length > 0) {
          for (const feature of songData.featuredArtists) {
            if (!feature.artistId) {
              throw new Error(`Missing artistId for featured artist in song: ${songData.title}`);
            }

            const ftArtist = new FT({
              trackId: track._id,
              artistId: feature.artistId,
              contribution: feature.contribution || 'vocals',
              credits: {
                billingOrder: feature.billingOrder || featuredArtists.length + 1,
                displayName: feature.displayName,
                primaryArtist: false,
                featured: true
              }
            });
            featuredArtists.push(ftArtist);
          }
        }
      }

      // Save everything in transaction
      await Song.insertMany(songsToSave, { session });
      await Track.insertMany(tracksToSave, { session });
      if (featuredArtists.length > 0) {
        await FT.insertMany(featuredArtists, { session });
      }
      await release.save({ session });

      await session.commitTransaction();

      return res.status(201).json({
        message: "Successfully created release",
        data: {
          releaseId: release._id,
          title: release.title,
          type: release.type,
          totalTracks: release.metadata.totalTracks
        }
      });

    } catch (error) {
      await session.abortTransaction();
      return res.status(500).json({
        message: "Error creating release",
        error: error.message,
        details: error.errors ? Object.values(error.errors).map(err => err.message) : null
      });
    } finally {
      session.endSession();
    }
  };

// Analytics and Interactions
const streamSong = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { songId, userId, } = req.params;
      const { completionRate = 0, timestamp, offline = false, deviceType = 'unknown', quality = 'standard', region = 'unknown'  } = req.body;

      // Update song analytics with default values and proper type conversion
      const songUpdate = {
        $inc: {
          "analytics.totalStreams": 1
        },
        $push: {
          streamHistory: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            deviceType: deviceType,
            quality: quality,
            region: region,
            completionRate: Number(completionRate) || 0,
            offline: Boolean(offline)
          }
        }
      };

      // Check if it's a first-time listener
      const existingStream = await Song.findOne({
        _id: songId,
        "streamHistory.userId": new mongoose.Types.ObjectId(userId)
      }).session(session);

      if (!existingStream) {
        songUpdate.$inc["analytics.uniqueListeners"] = 1;
      }

      const updatedSong = await Song.findByIdAndUpdate(
        songId,
        songUpdate,
        { session, new: true }
      );

      if (!updatedSong) {
        throw new Error("Song not found");
      }

      // Update track metrics with proper type handling
      const track = await Track.findOne({ songId }).session(session);
      if (track) {
        // Calculate average completion rate
        const avgCompletionUpdate = {
          $inc: {
            "interactions.totalStreams": 1,
            "interactions.totalCompletionRate": Number(completionRate) || 0
          },
          $set: {
            "interactions.avgCompletionRate": {
              $divide: [
                {
                  $add: [
                    {
                      $multiply: [
                        { $ifNull: ["$interactions.avgCompletionRate", 0] },
                        { $ifNull: ["$interactions.totalStreams", 0] }
                      ]
                    },
                    Number(completionRate) || 0
                  ]
                },
                {
                  $add: [
                    { $ifNull: ["$interactions.totalStreams", 0] },
                    1
                  ]
                }
              ]
            }
          }
        };

        if (Number(completionRate) < 0.3) {
          avgCompletionUpdate.$inc["interactions.skipCount"] = 1;
        }

        await Track.findByIdAndUpdate(
          track._id,
          avgCompletionUpdate,
          { session }
        );

        // Update regional data
        await Track.updateOne(
          { _id: track._id },
          {
            $push: {
              "regionalData": {
                region: region,
                streams: 1,
                skipRate: Number(completionRate) < 0.3 ? 1 : 0,
                timestamp: new Date()
              }
            }
          },
          { session }
        );

        // Update release metrics
        await Release.findByIdAndUpdate(
          track.releaseId,
          {
            $inc: {
              "analytics.totalStreams": 1
            }
          },
          { session }
        );
      }

      // Record in listening history
      const lastPlayed = new LastPlayed({
        userId: new mongoose.Types.ObjectId(userId),
        trackId: track._id,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        deviceType: deviceType,
        quality: quality,
        completionRate: Number(completionRate) || 0
      });

      await lastPlayed.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        message: "Stream recorded successfully",
        data: {
          songId: updatedSong._id,
          streamCount: updatedSong.analytics.totalStreams,
          completionRate: Number(completionRate) || 0
        }
      });

    } catch (error) {
      await session.abortTransaction();
      console.error("Stream recording error:", error);
      return res.status(500).json({
        message: "Error recording stream",
        error: error.message
      });
    } finally {
      session.endSession();
    }
  };

  // Helper function to calculate average completion rate
  const calculateAverageCompletion = (currentAvg, currentTotal, newValue) => {
    const total = currentTotal + 1;
    return ((currentAvg * currentTotal) + newValue) / total;
  };

const shareSong = async (req, res) => {
  try {
    const { songId } = req.params;
    const { platform, userId } = req.body;

    const validPlatforms = ['facebook', 'twitter', 'whatsapp', 'other'];
    const sharePlatform = validPlatforms.includes(platform) ? platform : 'other';

    const updateQuery = {
      $inc: {
        "analytics.shares.total": 1,
        [`analytics.shares.platforms.${sharePlatform}`]: 1
      }
    };

    const song = await Song.findByIdAndUpdate(songId, updateQuery, { new: true });

    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    // Update track sharing metrics
    const track = await Track.findOne({ songId });
    if (track) {
      await Track.findByIdAndUpdate(track._id, {
        $inc: {
          "interactions.shares": 1
        }
      });

      // Update release sharing metrics
      await Release.findByIdAndUpdate(track.releaseId, {
        $inc: {
          "analytics.shares.total": 1,
          [`analytics.shares.platforms.${sharePlatform}`]: 1
        }
      });
    }

    return res.status(200).json({
      message: "Share recorded successfully",
      data: song
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error recording share",
      error: error.message
    });
  }
};

const addToPlaylist = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { songId } = req.params;
    const { playlistId, userId } = req.body;

    const song = await Song.findByIdAndUpdate(
      songId,
      {
        $inc: { "analytics.playlistAdditions": 1 },
        $push: {
          playlists: {
            playlistId,
            addedAt: new Date()
          }
        }
      },
      { session, new: true }
    );

    if (!song) {
      throw new Error("Song not found");
    }

    const track = await Track.findOne({ songId }).session(session);
    if (track) {
      await Track.findByIdAndUpdate(
        track._id,
        {
          $inc: { "interactions.playlists": 1 }
        },
        { session }
      );

      await Release.findByIdAndUpdate(
        track.releaseId,
        {
          $inc: { "analytics.playlists.user": 1 }
        },
        { session }
      );
    }

    await session.commitTransaction();
    return res.status(200).json({
      message: "Song added to playlist successfully",
      data: song
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Error adding song to playlist",
      error: error.message
    })} finally {
        session.endSession();
      }
    };

    const getTopSongs = async (req, res) => {
      try {
        const { timeframe = '7d', limit = 100, genre, region } = req.query;

        const endDate = new Date();
        const startDate = new Date();
        switch (timeframe) {
          case '24h': startDate.setDate(endDate.getDate() - 1); break;
          case '7d': startDate.setDate(endDate.getDate() - 7); break;
          case '30d': startDate.setDate(endDate.getDate() - 30); break;
        }

        const matchStage = {
          $match: {
            "streamHistory.timestamp": {
              $gte: startDate,
              $lte: endDate
            }
          }
        };

        if (genre) {
          matchStage.$match["metadata.genre"] = genre;
        }

        if (region) {
          matchStage.$match["streamHistory.region"] = region;
        }

        const songs = await Song.aggregate([
          matchStage,
          {
            $addFields: {
              recentStreams: {
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
            $addFields: {
              weightedScore: {
                $add: [
                  { $multiply: ["$recentStreams", 1] },
                  { $multiply: ["$analytics.playlistAdditions", 2] },
                  { $multiply: ["$analytics.shares.total", 3] },
                  { $multiply: ["$analytics.likes", 1.5] }
                ]
              }
            }
          },
          {
            $project: {
              _id: 1,
              title: "$track.title",
              artist: "$artist.name",
              release: "$release.title",
              cover: "$release.artwork.cover_image",
              stats: {
                streams: "$recentStreams",
                playlist_adds: "$analytics.playlistAdditions",
                shares: "$analytics.shares.total",
                likes: "$analytics.likes",
                score: "$weightedScore"
              }
            }
          },
          {
            $sort: { "stats.score": -1 }
          },
          {
            $limit: parseInt(limit)
          }
        ]);

        return res.status(200).json({
          message: "Successfully retrieved top songs",
          timeframe,
          genre: genre || 'all',
          region: region || 'global',
          data: songs
        });

      } catch (error) {
        return res.status(500).json({
          message: "Error fetching top songs",
          error: error.message
        });
      }
    };

    const getTrendingSongsByRegion = async (req, res) => {
      try {
        const { region } = req.params;
        const { timeframe = '24h', limit = 50 } = req.query;

        const endDate = new Date();
        const startDate = new Date();
        switch (timeframe) {
          case '24h': startDate.setDate(endDate.getDate() - 1); break;
          case '7d': startDate.setDate(endDate.getDate() - 7); break;
          case '30d': startDate.setDate(endDate.getDate() - 30); break;
        }

        const trendingSongs = await Song.aggregate([
          {
            $match: {
              "streamHistory": {
                $elemMatch: {
                  region: region,
                  timestamp: { $gte: startDate, $lte: endDate }
                }
              }
            }
          },
          {
            $addFields: {
              regionalStats: {
                streams: {
                  $size: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $and: [
                          { $eq: ["$$this.region", region] },
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
            $project: {
              _id: 1,
              title: "$track.title",
              artist: "$artist.name",
              release: "$release.title",
              cover: "$release.artwork.cover_image",
              regionalStats: 1,
              genre: "$track.metadata.genre",
              duration: "$track.duration"
            }
          },
          {
            $sort: { "regionalStats.streams": -1 }
          },
          {
            $limit: parseInt(limit)
          }
        ]);

        return res.status(200).json({
          message: "Successfully retrieved trending songs",
          region,
          timeframe,
          data: trendingSongs
        });

      } catch (error) {
        return res.status(500).json({
          message: "Error fetching trending songs",
          error: error.message
        });
      }
    };

    // Metadata Management
    const updateSongMetadata = async (req, res) => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const { songId } = req.params;
        const {
          isExplicit,
          isInstrumental,
          hasLyrics,
          lyrics,
          waveform,
          audioQuality,
          genre,
          language,
          mood,
          tags
        } = req.body;

        const song = await Song.findByIdAndUpdate(
          songId,
          {
            $set: {
              "flags.isExplicit": isExplicit,
              "flags.isInstrumental": isInstrumental,
              "flags.hasLyrics": hasLyrics,
              lyrics,
              waveform,
              audioQuality,
              "metadata.genre": genre,
              "metadata.language": language,
              "metadata.mood": mood,
              tags
            }
          },
          { session, new: true }
        );

        if (!song) {
          throw new Error("Song not found");
        }
        // Update associated track metadata
        const track = await Track.findOne({ songId }).session(session);
        if (track) {
          await Track.findByIdAndUpdate(
            track._id,
            {
              $set: {
                "flags.isExplicit": isExplicit,
                "flags.isInstrumental": isInstrumental,
                "flags.hasLyrics": hasLyrics,
                "metadata.genre": genre,
                "metadata.languageCode": language,
                "metadata.mood": mood,
                tags
              }
            },
            { session }
          );
        }

        await session.commitTransaction();
        return res.status(200).json({
          message: "Song metadata updated successfully",
          data: song
        });

      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({
          message: "Error updating song metadata",
          error: error.message
        });
      } finally {
        session.endSession();
      }
    };

// Get detailed song engagement metrics
const getSongEngagementMetrics = async (req, res) => {
  try {
    const { songId } = req.params;
    const { timeframe = '30d', userId } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '24h': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case 'all': startDate.setDate(endDate.getDate() - 365); break;
    }

    const engagement = await Song.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(songId)
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "songId",
          as: "trackInfo"
        }
      },
      {
        $unwind: "$trackInfo"
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackInfo.releaseId",
          foreignField: "_id",
          as: "releaseInfo"
        }
      },
      {
        $unwind: "$releaseInfo"
      },
      {
        $addFields: {
          // Time-based metrics
          timeBasedMetrics: {
            recentStreams: {
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
            },
            uniqueListeners: {
              $size: {
                $setUnion: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$streamHistory",
                        cond: {
                          $and: [
                            { $gte: ["$$this.timestamp", startDate] },
                            { $lte: ["$$this.timestamp", endDate] }
                          ]
                        }
                      }
                    },
                    as: "stream",
                    in: "$$stream.userId"
                  }
                }
              }
            }
          },
          // Engagement quality metrics
          qualityMetrics: {
            averageCompletionRate: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $and: [
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] }
                        ]
                      }
                    }
                  },
                  as: "stream",
                  in: "$$stream.completionRate"
                }
              }
            },
            skipRate: {
              $divide: [
                {
                  $size: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $and: [
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] },
                          { $lt: ["$$this.completionRate", 0.3] }
                        ]
                      }
                    }
                  }
                },
                {
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
              ]
            }
          },
          // Time analysis
          timeAnalysis: {
            peakHours: {
              $map: {
                input: { $range: [0, 24] },
                as: "hour",
                in: {
                  hour: "$$hour",
                  count: {
                    $size: {
                      $filter: {
                        input: "$streamHistory",
                        cond: {
                          $and: [
                            { $eq: [{ $hour: "$$this.timestamp" }, "$$hour"] },
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
            weekdayDistribution: {
              $map: {
                input: { $range: [0, 7] },
                as: "day",
                in: {
                  day: "$$day",
                  count: {
                    $size: {
                      $filter: {
                        input: "$streamHistory",
                        cond: {
                          $and: [
                            { $eq: [{ $dayOfWeek: "$$this.timestamp" }, "$$day"] },
                            { $gte: ["$$this.timestamp", startDate] },
                            { $lte: ["$$this.timestamp", endDate] }
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          // Platform and device metrics
          platformMetrics: {
            deviceTypes: {
              $reduce: {
                input: "$streamHistory",
                initialValue: {},
                in: {
                  $mergeObjects: [
                    "$$value",
                    {
                      $cond: {
                        if: {
                          $and: [
                            { $gte: ["$$this.timestamp", startDate] },
                            { $lte: ["$$this.timestamp", endDate] }
                          ]
                        },
                        then: {
                          $let: {
                            vars: {
                              device: "$$this.deviceType"
                            },
                            in: {
                              $mergeObjects: [
                                "$$value",
                                { "$$device": { $add: [{ $ifNull: ["$$value.$$device", 0] }, 1] } }
                              ]
                            }
                          }
                        },
                        else: "$$value"
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    ]);

    // Get user-specific engagement if userId provided
    let userEngagement = null;
    if (userId) {
      userEngagement = await Song.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(songId),
            "streamHistory.userId": new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $project: {
            userStreams: {
              $size: {
                $filter: {
                  input: "$streamHistory",
                  cond: {
                    $and: [
                      { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                      { $gte: ["$$this.timestamp", startDate] },
                      { $lte: ["$$this.timestamp", endDate] }
                    ]
                  }
                }
              }
            },
            averageCompletion: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)]
                      }
                    }
                  },
                  as: "stream",
                  in: "$$stream.completionRate"
                }
              }
            }
          }
        }
      ]);
    }

    return res.status(200).json({
      message: "Successfully retrieved song engagement metrics",
      timeframe,
      data: {
        ...engagement[0],
        userEngagement: userEngagement?.[0] || null
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching song engagement",
      error: error.message
    });
  }
};

// Save/Unsave Release (Album/EP/Single)
const toggleSavedRelease = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, releaseId } = req.params;

    // Verify release exists
    const release = await Release.findById(releaseId).session(session);
    if (!release) {
      throw new Error("Release not found");
    }

    // Check if already saved
    const existingSave = await SavedRelease.findOne({ userId, releaseId }).session(session);

    if (existingSave) {
      // Unsave
      await SavedRelease.deleteOne({ userId, releaseId }).session(session);
      await Release.findByIdAndUpdate(releaseId, {
        $inc: { "analytics.saves": -1 }
      }).session(session);

      await session.commitTransaction();
      return res.status(200).json({
        message: "Release unsaved successfully",
        saved: false
      });
    } else {
      // Save
      const savedRelease = new SavedRelease({
        userId,
        releaseId,
        saveDate: new Date(),
        releaseType: release.type
      });

      await savedRelease.save({ session });
      await Release.findByIdAndUpdate(releaseId, {
        $inc: { "analytics.saves": 1 }
      }).session(session);

      await session.commitTransaction();
      return res.status(200).json({
        message: "Release saved successfully",
        saved: true
      });
    }

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Error toggling saved release",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get user's saved releases with filtering
const getSavedReleases = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, sort = 'recent', page = 1, limit = 20 } = req.query;

    const query = { userId };
    if (type) {
      query.releaseType = type;
    }

    const sortOptions = {
      recent: { saveDate: -1 },
      oldest: { saveDate: 1 },
      alphabetical: { 'release.title': 1 }
    };

    const savedReleases = await SavedRelease.aggregate([
      {
        $match: query
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
          localField: "release.artistId",
          foreignField: "_id",
          as: "artist"
        }
      },
      {
        $unwind: "$artist"
      },
      {
        $sort: sortOptions[sort] || sortOptions.recent
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    const total = await SavedRelease.countDocuments(query);

    return res.status(200).json({
      message: "Successfully retrieved saved releases",
      data: savedReleases,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasMore: total > (page * limit)
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching saved releases",
      error: error.message
    });
  }
};

// Get user's most interacted songs
const getUserTopSongs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeframe = '30d', limit = 20 } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case 'all': startDate.setDate(endDate.getDate() - 365); break;
    }

    const topSongs = await Song.aggregate([
      {
        $match: {
          "streamHistory": {
            $elemMatch: {
              userId: new mongoose.Types.ObjectId(userId),
              timestamp: { $gte: startDate, $lte: endDate }
            }
          }
        }
      },
      {
        $addFields: {
          userInteractions: {
            streams: {
              $size: {
                $filter: {
                  input: "$streamHistory",
                  cond: {
                    $and: [
                      { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                      { $gte: ["$$this.timestamp", startDate] },
                      { $lte: ["$$this.timestamp", endDate] }
                    ]
                  }
                }
              }
            },
            avgCompletion: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $and: [
                          { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] }
                        ]
                      }
                    }
                  },
                  as: "stream",
                  in: "$$stream.completionRate"
                }
              }
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
        $project: {
          _id: 1,
          title: "$track.title",
          artist: "$artist.name",
          release: "$release.title",
          cover: "$release.artwork.cover_image",
          interactions: "$userInteractions",
           // Continuing the getUserTopSongs aggregation pipeline...
          track: {
            duration: "$track.duration",
            releaseDate: "$release.dates.release_date"
          },
          interactionScore: {
            $add: [
              { $multiply: ["$userInteractions.streams", 1] },
              { $multiply: ["$userInteractions.avgCompletion", 2] }
            ]
          }
        }
      },
      {
        $sort: { interactionScore: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved user's top songs",
      timeframe,
      data: topSongs
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching user's top songs",
      error: error.message
    });
  }
};

// Get user's listening history with details
const getUserListeningHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const history = await Song.aggregate([
      {
        $match: {
          "streamHistory": {
            $elemMatch: {
              userId: new mongoose.Types.ObjectId(userId),
              ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
            }
          }
        }
      },
      {
        $unwind: "$streamHistory"
      },
      {
        $match: {
          "streamHistory.userId": new mongoose.Types.ObjectId(userId),
          ...(Object.keys(dateFilter).length && { "streamHistory.timestamp": dateFilter })
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
        $project: {
          _id: 1,
          playedAt: "$streamHistory.timestamp",
          completionRate: "$streamHistory.completionRate",
          deviceType: "$streamHistory.deviceType",
          quality: "$streamHistory.quality",
          song: {
            title: "$track.title",
            duration: "$track.duration",
            artist: "$artist.name",
            release: "$release.title",
            cover: "$release.artwork.cover_image",
            type: "$release.type"
          }
        }
      },
      {
        $sort: { playedAt: -1 }
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Get total count for pagination
    const total = await Song.countDocuments({
      "streamHistory": {
        $elemMatch: {
          userId: new mongoose.Types.ObjectId(userId),
          ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
        }
      }
    });

    return res.status(200).json({
      message: "Successfully retrieved listening history",
      data: history,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: total > (page * limit)
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching listening history",
      error: error.message
    });
  }
};

// Get user's listening insights
const getUserListeningInsights = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeframe = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case 'all': startDate.setDate(endDate.getDate() - 365); break;
    }

    const insights = await Song.aggregate([
      {
        $match: {
          "streamHistory": {
            $elemMatch: {
              userId: new mongoose.Types.ObjectId(userId),
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
        $group: {
          _id: null,
          totalStreams: {
            $sum: {
              $size: {
                $filter: {
                  input: "$streamHistory",
                  cond: {
                    $and: [
                      { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                      { $gte: ["$$this.timestamp", startDate] },
                      { $lte: ["$$this.timestamp", endDate] }
                    ]
                  }
                }
              }
            }
          },
          uniqueSongs: { $addToSet: "$_id" },
          genres: { $addToSet: "$track.metadata.genre" },
          avgCompletionRate: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: "$streamHistory",
                    cond: {
                      $and: [
                        { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                        { $gte: ["$$this.timestamp", startDate] },
                        { $lte: ["$$this.timestamp", endDate] }
                      ]
                    }
                  }
                },
                as: "stream",
                in: "$$stream.completionRate"
              }
            }
          },
          deviceTypes: {
            $addToSet: "$streamHistory.deviceType"
          },
          totalListeningTime: {
            $sum: {
              $multiply: [
                "$track.duration",
                {
                  $size: {
                    $filter: {
                      input: "$streamHistory",
                      cond: {
                        $and: [
                          { $eq: ["$$this.userId", new mongoose.Types.ObjectId(userId)] },
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalStreams: 1,
          uniqueSongs: { $size: "$uniqueSongs" },
          genres: 1,
          avgCompletionRate: 1,
          deviceTypes: 1,
          totalListeningTime: 1,
          avgDailyListeningTime: {
            $divide: ["$totalListeningTime", { $subtract: [endDate, startDate] }]
          }
        }
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved listening insights",
      timeframe,
      data: insights[0] || {
        totalStreams: 0,
        uniqueSongs: 0,
        genres: [],
        avgCompletionRate: 0,
        deviceTypes: [],
        totalListeningTime: 0,
        avgDailyListeningTime: 0
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching listening insights",
      error: error.message
    });
  }
};

const getTopSongsForArtist = async (req, res) => {
    try {
      const { artistId } = req.params;
      const {
        timeframe = '30d',
        limit = 10,
        includeFeatures = 'true',
        sort = 'streams' // 'streams' | 'recent' | 'popularity'
      } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeframe) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case 'all': startDate.setDate(endDate.getDate() - 365); break;
      }

      // Build match conditions for artist involvement
      const artistMatch = includeFeatures === 'true'
        ? {
            $or: [
              { "artistId": new mongoose.Types.ObjectId(artistId) },
              { "featuredArtists.artistId": new mongoose.Types.ObjectId(artistId) }
            ]
          }
        : { "artistId": new mongoose.Types.ObjectId(artistId) };

      const songs = await Track.aggregate([
        {
          $match: artistMatch
        },
        // Lookup songs
        {
          $lookup: {
            from: "songs",
            localField: "songId",
            foreignField: "_id",
            as: "songData"
          }
        },
        {
          $unwind: {
            path: "$songData",
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup releases
        {
          $lookup: {
            from: "releases",
            localField: "releaseId",
            foreignField: "_id",
            as: "releaseData"
          }
        },
        {
          $unwind: {
            path: "$releaseData",
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup main artist
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artistData"
          }
        },
        {
          $unwind: {
            path: "$artistData",
            preserveNullAndEmptyArrays: true
          }
        },
        // Lookup featured artists
        {
          $lookup: {
            from: "ft",
            localField: "_id",
            foreignField: "trackId",
            as: "featuredArtists"
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "featuredArtists.artistId",
            foreignField: "_id",
            as: "featuredArtistsData"
          }
        },
        // Calculate metrics with null checks
        {
          $addFields: {
            recentStreams: {
              $size: {
                $ifNull: [
                  {
                    $filter: {
                      input: { $ifNull: ["$songData.streamHistory", []] },
                      cond: {
                        $and: [
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] }
                        ]
                      }
                    }
                  },
                  []
                ]
              }
            },
            avgCompletionRate: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ["$songData.streamHistory", []] },
                      cond: {
                        $and: [
                          { $gte: ["$$this.timestamp", startDate] },
                          { $lte: ["$$this.timestamp", endDate] }
                        ]
                      }
                    }
                  },
                  as: "stream",
                  in: { $ifNull: ["$$stream.completionRate", 0] }
                }
              }
            },
            popularityScore: {
              $add: [
                { $multiply: [{ $ifNull: ["$songData.analytics.totalStreams", 0] }, 1] },
                { $multiply: [{ $ifNull: ["$songData.analytics.playlistAdditions", 0] }, 2] },
                { $multiply: [{ $ifNull: ["$songData.analytics.shares.total", 0] }, 3] },
                { $multiply: [{ $ifNull: ["$songData.analytics.likes", 0] }, 1.5] }
              ]
            }
          }
        },
        // Project final shape with null checks
        {
          $project: {
            _id: 1,
            title: 1,
            duration: 1,
            releaseDate: { $ifNull: ["$releaseData.dates.release_date", null] },
            release: {
              _id: { $ifNull: ["$releaseData._id", null] },
              title: { $ifNull: ["$releaseData.title", ""] },
              type: { $ifNull: ["$releaseData.type", ""] },
              artwork: { $ifNull: ["$releaseData.artwork.cover_image", null] }
            },
            artist: {
              _id: { $ifNull: ["$artistData._id", null] },
              name: { $ifNull: ["$artistData.name", ""] },
              image: { $ifNull: ["$artistData.profileImage", null] }
            },
            featuredArtists: {
              $ifNull: [
                {
                  $map: {
                    input: { $ifNull: ["$featuredArtistsData", []] },
                    as: "artist",
                    in: {
                      _id: "$$artist._id",
                      name: "$$artist.name"
                    }
                  }
                },
                []
              ]
            },
            analytics: {
              totalStreams: { $ifNull: ["$songData.analytics.totalStreams", 0] },
              recentStreams: "$recentStreams",
              playlistAdditions: { $ifNull: ["$songData.analytics.playlistAdditions", 0] },
              shares: { $ifNull: ["$songData.analytics.shares.total", 0] },
              likes: { $ifNull: ["$songData.analytics.likes", 0] },
              avgCompletionRate: { $ifNull: ["$avgCompletionRate", 0] },
              popularityScore: "$popularityScore"
            }
          }
        },
        // Sort based on user preference
        {
          $sort: sort === 'recent'
            ? { "releaseDate": -1 }
            : sort === 'popularity'
              ? { "analytics.popularityScore": -1 }
              : { "analytics.recentStreams": -1 }
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      return res.status(200).json({
        message: "Successfully retrieved artist's top songs",
        data: songs,
        metadata: {
          timeframe,
          includesFeatures: includeFeatures === 'true',
          sortedBy: sort
        }
      });

    } catch (error) {
      console.error("Error in getTopSongsForArtist:", error);
      return res.status(500).json({
        message: "Error fetching artist's top songs",
        error: error.message
      });
    }
  };

  // Get artist's albums and EPs with detailed metadata
  const getAlbumsAndEpByArtist = async (req, res) => {
    try {
      const { artistId } = req.params;
      const {
        sort = 'recent', // 'recent' | 'popular' | 'alphabetical'
        type = 'all', // 'all' | 'album' | 'ep'
        page = 1,
        limit = 20
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const matchStage = {
        artistId: new mongoose.Types.ObjectId(artistId),
        type: type === 'all'
          ? { $in: ['album', 'ep'] }
          : type
      };

      const releases = await Release.aggregate([
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
        // Lookup artist
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $unwind: {
            path: "$artist",
            preserveNullAndEmptyArrays: true
          }
        },
        // Calculate release stats
        {
          $addFields: {
            totalTracks: {
              $size: { $ifNull: ["$tracks", []] }
            }
          }
        },
        {
          $project: {
            _id: 1,
            title: { $ifNull: ["$title", ""] },
            type: { $ifNull: ["$type", ""] },
            artwork: { $ifNull: ["$artwork.cover_image", null] },
            releaseDate: { $ifNull: ["$dates.release_date", null] },
            artist: {
              _id: { $ifNull: ["$artist._id", null] },
              name: { $ifNull: ["$artist.name", ""] },
              image: { $ifNull: ["$artist.profileImage", null] }
            },
            metadata: {
              totalTracks: "$totalTracks",
              genre: { $ifNull: ["$metadata.genre", []] },
              label: { $ifNull: ["$commercial.label", ""] }
            },
            analytics: {
              totalStreams: { $toInt: { $ifNull: ["$analytics.totalStreams", 0] } },
              saves: { $toInt: { $ifNull: ["$analytics.saves", 0] } },
              shares: { $toInt: { $ifNull: ["$analytics.shares.total", 0] } }
            }
          }
        },
        // Add popularity score after converting numbers
        {
          $addFields: {
            "analytics.popularityScore": {
              $add: [
                "$analytics.totalStreams",
                { $multiply: ["$analytics.saves", 2] },
                { $multiply: ["$analytics.shares", 1.5] }
              ]
            }
          }
        },
        {
          $sort: sort === 'recent'
            ? { "releaseDate": -1 }
            : sort === 'popular'
              ? { "analytics.popularityScore": -1 }
              : { "title": 1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      // Get total count for pagination
      const total = await Release.countDocuments(matchStage);

      return res.status(200).json({
        message: "Successfully retrieved artist's albums and EPs",
        data: releases,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasMore: total > (skip + releases.length)
        }
      });

    } catch (error) {
      console.error("Error in getAlbumsAndEpByArtist:", error);
      return res.status(500).json({
        message: "Error fetching artist's albums and EPs",
        error: error.message
      });
    }
  };

  // Get artist's singles
  const getSingles = async (req, res) => {
    try {
      const { artistId } = req.params;
      const {
        timeframe = 'all',
        sort = 'recent',
        page = 1,
        limit = 20
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Calculate date range for timeframe filtering
      const endDate = new Date();
      const startDate = new Date();
      if (timeframe !== 'all') {
        switch (timeframe) {
          case '30d': startDate.setDate(endDate.getDate() - 30); break;
          case '90d': startDate.setDate(endDate.getDate() - 90); break;
          case '180d': startDate.setDate(endDate.getDate() - 180); break;
          case '1y': startDate.setDate(endDate.getDate() - 365); break;
        }
      }

      const matchStage = {
        artistId: new mongoose.Types.ObjectId(artistId),
        type: 'single',
        ...(timeframe !== 'all' && {
          "dates.release_date": {
            $gte: startDate,
            $lte: endDate
          }
        })
      };

      const singles = await Release.aggregate([
        {
          $match: matchStage
        },
        // Lookup the single track
        {
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "releaseId",
            as: "track"
          }
        },
        {
          $unwind: "$track"
        },
        // Lookup song data
        {
          $lookup: {
            from: "songs",
            localField: "track.songId",
            foreignField: "_id",
            as: "songData"
          }
        },
        {
          $unwind: "$songData"
        },
        // Lookup artist
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
        // Lookup featured artists
        {
          $lookup: {
            from: "ft",
            localField: "track._id",
            foreignField: "trackId",
            as: "features"
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "features.artistId",
            foreignField: "_id",
            as: "featuredArtists"
          }
        },
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $multiply: ["$songData.analytics.totalStreams", 1] },
                { $multiply: ["$analytics.saves", 2] },
                { $multiply: ["$songData.analytics.shares.total", 1.5] },
                { $multiply: ["$songData.analytics.playlistAdditions", 2] }
              ]
            }
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            artwork: "$artwork.cover_image",
            releaseDate: "$dates.release_date",
            track: {
              _id: "$track._id",
              title: "$track.title",
              duration: "$track.duration",
              isExplicit: "$track.flags.isExplicit"
            },
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            featuredArtists: {
              $map: {
                input: "$featuredArtists",
                as: "artist",
                in: {
                  _id: "$$artist._id",
                  name: "$$artist.name"
                }
              }
            },
            metadata: {
              genre: "$metadata.genre",
              label: "$commercial.label",
              isrc: "$songData.isrc"
            },
            analytics: {
              streams: "$songData.analytics.totalStreams",
              saves: "$analytics.saves",
              shares: "$songData.analytics.shares.total",
              playlists: {
                total: "$analytics.playlists.total",
                editorial: "$analytics.playlists.editorial"
              },
              popularityScore: "$popularityScore"
            }
          }
        },
        {
          $sort: sort === 'recent'
            ? { "releaseDate": -1 }
            : sort === 'popular'
              ? { "analytics.popularityScore": -1 }
              : { "title": 1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      // Get total count for pagination
      const total = await Release.countDocuments(matchStage);

      return res.status(200).json({
        message: "Successfully retrieved artist's singles",
        data: singles,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasMore: total > (skip + singles.length)
        }
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching artist's singles",
        error: error.message
      });
    }
  };

  const getAllReleases = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        genre,
        sort = 'recent',
        artist,
        year,
        search,
        start_date,
        end_date,
        label,
        isExplicit,
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build match stage for filtering
      const matchStage = {};

      // Filter by release type
      if (type) {
        matchStage.type = type.includes(',') ? { $in: type.split(',') } : type;
      }

      // Filter by genre
      if (genre) {
        matchStage['metadata.genre'] = genre.includes(',')
          ? { $in: genre.split(',') }
          : genre;
      }

      // Filter by artist (can be ID or name)
      if (artist) {
        if (mongoose.Types.ObjectId.isValid(artist)) {
          matchStage.artistId = new mongoose.Types.ObjectId(artist);
        } else {
          // Will match artist name in the lookup stage
          matchStage['artist.name'] = new RegExp(artist, 'i');
        }
      }

      // Filter by year
      if (year) {
        matchStage['dates.release_date'] = {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        };
      }

      // Filter by date range
      if (start_date || end_date) {
        matchStage['dates.release_date'] = {};
        if (start_date) {
          matchStage['dates.release_date'].$gte = new Date(start_date);
        }
        if (end_date) {
          matchStage['dates.release_date'].$lte = new Date(end_date);
        }
      }

      // Filter by label
      if (label) {
        matchStage['commercial.label'] = new RegExp(label, 'i');
      }

      // Filter by explicit content
      if (isExplicit !== undefined) {
        matchStage['contentInfo.isExplicit'] = isExplicit === 'true';
      }

      // Text search
      if (search) {
        matchStage.$or = [
          { title: new RegExp(search, 'i') },
          { 'description.main': new RegExp(search, 'i') },
          { 'tags.user': new RegExp(search, 'i') }
        ];
      }

      // Define sort options
      const sortOptions = {
        recent: { 'dates.release_date': -1 },
        oldest: { 'dates.release_date': 1 },
        alphabetical: { title: 1 },
        streams: { 'analytics.totalStreams': -1 },
        saves: { 'analytics.saves': -1 },
        popularity: { successScore: -1 }
      };

      const releases = await Release.aggregate([
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
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "releaseId",
            as: "tracks"
          }
        },
        {
          // Calculate success score and other metrics
          $addFields: {
            successScore: {
              $add: [
                { $multiply: ["$analytics.totalStreams", 1] },
                { $multiply: ["$analytics.saves", 2] },
                { $multiply: ["$analytics.shares.total", 3] },
                { $multiply: ["$analytics.playlists.total", 4] }
              ]
            },
            totalTracks: { $size: "$tracks" }
          }
        },
        {
          $match: matchStage
        },
        {
          $sort: sortOptions[sort] || sortOptions.recent
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            _id: 1,
            title: 1,
            type: 1,
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            artwork: "$artwork.cover_image",
            dates: {
              release_date: "$dates.release_date",
              announcement_date: "$dates.announcement_date"
            },
            metadata: {
              genre: "$metadata.genre",
              totalTracks: "$totalTracks",
              duration: "$metadata.duration",
              language: "$metadata.language"
            },
            commercial: {
              label: "$commercial.label",
              upc: "$commercial.upc"
            },
            analytics: {
              totalStreams: "$analytics.totalStreams",
              saves: "$analytics.saves",
              shares: "$analytics.shares.total",
              playlists: {
                total: "$analytics.playlists.total",
                editorial: "$analytics.playlists.editorial",
                user: "$analytics.playlists.user"
              }
            },
            contentInfo: {
              isExplicit: "$contentInfo.isExplicit",
              contentWarnings: "$contentInfo.contentWarnings"
            },
            successScore: 1
          }
        }
      ]);

      // Get total count for pagination
      const totalReleases = await Release.countDocuments(matchStage);

      // Get unique genres, labels, and years for filters
      const aggregateFilters = await Release.aggregate([
        {
          $match: matchStage
        },
        {
          $group: {
            _id: null,
            genres: { $addToSet: "$metadata.genre" },
            labels: { $addToSet: "$commercial.label" },
            years: {
              $addToSet: {
                $year: "$dates.release_date"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            genres: { $filter: { input: "$genres", as: "genre", cond: { $ne: ["$$genre", null] } } },
            labels: { $filter: { input: "$labels", as: "label", cond: { $ne: ["$$label", null] } } },
            years: { $filter: { input: "$years", as: "year", cond: { $ne: ["$$year", null] } } }
          }
        }
      ]);

      return res.status(200).json({
        message: "Successfully retrieved releases",
        data: releases,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalReleases / parseInt(limit)),
          hasMore: totalReleases > (skip + releases.length)
        },
        filters: aggregateFilters[0] || { genres: [], labels: [], years: [] },
        meta: {
          total: totalReleases,
          appliedFilters: {
            type,
            genre,
            artist,
            year,
            label,
            isExplicit,
            search,
            sort
          }
        }
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching releases",
        error: error.message
      });
    }
  };

  // Get a single release with detailed information
const getRelease = async (req, res) => {
    try {
      const { releaseId } = req.params;

      const release = await Release.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(releaseId)
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
        // Lookup featured artists for each track
        {
          $lookup: {
            from: "ft",
            localField: "tracks._id",
            foreignField: "trackId",
            as: "features"
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "features.artistId",
            foreignField: "_id",
            as: "featuredArtists"
          }
        },
        {
          $addFields: {
            successScore: {
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
          $project: {
            _id: 1,
            title: 1,
            type: 1,
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage",
              bio: "$artist.bio"
            },
            artwork: 1,
            dates: 1,
            metadata: 1,
            commercial: 1,
            analytics: 1,
            description: 1,
            contentInfo: 1,
            successScore: 1,
            tracks: {
              $map: {
                input: "$tracks",
                as: "track",
                in: {
                  _id: "$$track._id",
                  title: "$$track.title",
                  duration: "$$track.duration",
                  track_number: "$$track.track_number",
                  disc_number: "$$track.disc_number",
                  features: {
                    $filter: {
                      input: "$featuredArtists",
                      as: "artist",
                      cond: {
                        $in: ["$$artist._id", "$features.artistId"]
                      }
                    }
                  },
                  metadata: "$$track.metadata",
                  flags: "$$track.flags"
                }
              }
            },
            availability: 1,
            credits: 1,
            tags: 1
          }
        }
      ]);

      if (!release.length) {
        return res.status(404).json({
          message: "Release not found"
        });
      }

      return res.status(200).json({
        message: "Successfully retrieved release",
        data: release[0]
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error fetching release",
        error: error.message
      });
    }
  };

  // Get search suggestions/autocomplete
  const getSearchSuggestions = async (req, res) => {
    try {
      const { query, limit = 5 } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({
          message: "Query must be at least 2 characters long"
        });
      }

      const searchRegex = new RegExp(query, 'i');

      // Get song suggestions
      const songs = await Track.aggregate([
        {
          $match: { title: searchRegex }
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
            _id: 1,
            title: 1,
            type: 'song',
            artist: "$artist.name"
          }
        },
        { $limit: parseInt(limit) }
      ]);

      // Get artist suggestions
      const artists = await Artist.aggregate([
        {
          $match: { name: searchRegex }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            type: 'artist',
            image: "$profileImage"
          }
        },
        { $limit: parseInt(limit) }
      ]);

      // Get release suggestions
      const releases = await Release.aggregate([
        {
          $match: { title: searchRegex }
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
            _id: 1,
            title: 1,
            type: 'release',
            artist: "$artist.name",
            releaseType: "$type"
          }
        },
        { $limit: parseInt(limit) }
      ]);

      // Combine and sort suggestions
      const suggestions = [...songs, ...artists, ...releases]
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.title?.toLowerCase() === query.toLowerCase() ||
                        a.name?.toLowerCase() === query.toLowerCase();
          const bExact = b.title?.toLowerCase() === query.toLowerCase() ||
                        b.name?.toLowerCase() === query.toLowerCase();

          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Then prioritize starts with
          const aStarts = (a.title?.toLowerCase().startsWith(query.toLowerCase()) ||
                          a.name?.toLowerCase().startsWith(query.toLowerCase()));
          const bStarts = (b.title?.toLowerCase().startsWith(query.toLowerCase()) ||
                          b.name?.toLowerCase().startsWith(query.toLowerCase()));

          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          return 0;
        })
        .slice(0, parseInt(limit));

      return res.status(200).json({
        message: "Successfully retrieved suggestions",
        data: suggestions
      });

    } catch (error) {
      return res.status(500).json({
        message: "Error getting search suggestions",
        error: error.message
      });
    }
  };

  const getTracksFromRelease = async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { sort = 'track_number' } = req.query;

      // Validate releaseId
      if (!mongoose.Types.ObjectId.isValid(releaseId)) {
        return res.status(400).json({
          message: "Invalid release ID format"
        });
      }

      // Define sort options
      const sortOptions = {
        track_number: { "track_number": 1 },
        popularity: { "analytics.totalStreams": -1 },
        title: { "title": 1 },
        duration: { "duration": 1 }
      };

      const tracks = await Track.aggregate([
        {
          $match: {
            releaseId: new mongoose.Types.ObjectId(releaseId)
          }
        },
        // Lookup song data
        {
          $lookup: {
            from: "songs",
            localField: "songId",
            foreignField: "_id",
            as: "songData"
          }
        },
        {
          $unwind: "$songData"
        },
        // Lookup release data
        {
          $lookup: {
            from: "releases",
            localField: "releaseId",
            foreignField: "_id",
            as: "releaseData"
          }
        },
        {
          $unwind: "$releaseData"
        },
        // Lookup main artist
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artistData"
          }
        },
        {
          $unwind: "$artistData"
        },
        // Lookup featured artists
        {
          $lookup: {
            from: "ft",
            localField: "_id",
            foreignField: "trackId",
            as: "featuredArtists"
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "featuredArtists.artistId",
            foreignField: "_id",
            as: "featuredArtistsData"
          }
        },
        // Calculate engagement metrics
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $multiply: ["$songData.analytics.totalStreams", 1] },
                { $multiply: ["$songData.analytics.playlistAdditions", 2] },
                { $multiply: ["$songData.analytics.shares.total", 3] },
                { $multiply: ["$songData.analytics.likes", 1.5] }
              ]
            },
            completionRate: {
              $cond: {
                if: { $gt: ["$interactions.totalStreams", 0] },
                then: {
                  $multiply: [
                    { $divide: ["$interactions.totalCompletionRate", "$interactions.totalStreams"] },
                    100
                  ]
                },
                else: 0
              }
            }
          }
        },
        // Project final shape
        {
          $project: {
            _id: 1,
            title: 1,
            version: 1,
            duration: 1,
            track_number: 1,
            disc_number: 1,
            isrc: "$metadata.isrc",
            artist: {
              _id: "$artistData._id",
              name: "$artistData.name",
              image: "$artistData.profileImage"
            },
            featuredArtists: {
              $map: {
                input: "$featuredArtistsData",
                as: "artist",
                in: {
                  _id: "$$artist._id",
                  name: "$$artist.name",
                  role: {
                    $arrayElemAt: [
                      "$featuredArtists.contribution",
                      { $indexOfArray: ["$featuredArtistsData._id", "$$artist._id"] }
                    ]
                  }
                }
              }
            },
            release: {
              _id: "$releaseData._id",
              title: "$releaseData.title",
              artwork: "$releaseData.artwork.cover_image",
              type: "$releaseData.type",
              releaseDate: "$releaseData.dates.release_date"
            },
            songData: {
              _id: "$songData._id",
              fileUrl: "$songData.fileUrl",
              format: "$songData.format",
              bitrate: "$songData.bitrate",
              waveform: "$songData.waveform"
            },
            metadata: {
              genre: "$metadata.genre",
              bpm: "$metadata.bpm",
              key: "$metadata.key",
              mood: "$metadata.mood",
              tags: "$metadata.tags",
              languageCode: "$metadata.languageCode"
            },
            lyrics: 1,
            flags: 1,
            analytics: {
              totalStreams: "$songData.analytics.totalStreams",
              uniqueListeners: "$songData.analytics.uniqueListeners",
              completionRate: "$completionRate",
              skipRate: {
                $multiply: [
                  { $divide: ["$interactions.skipCount", { $max: ["$interactions.totalStreams", 1] }] },
                  100
                ]
              },
              playlist: {
                total: "$songData.analytics.playlistAdditions",
                editorial: "$releaseData.analytics.playlists.editorial"
              },
              shares: "$songData.analytics.shares",
              likes: "$songData.analytics.likes",
              engagementScore: "$engagementScore"
            }
          }
        },
        {
          $sort: sortOptions[sort] || sortOptions.track_number
        }
      ]);

      // If no tracks found
      if (!tracks.length) {
        return res.status(404).json({
          message: "No tracks found for this release"
        });
      }

      // Calculate release-level statistics
      const releaseStats = {
        totalTracks: tracks.length,
        totalDuration: tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
        totalStreams: tracks.reduce((sum, track) => sum + (track.analytics.totalStreams || 0), 0),
        averageCompletionRate: tracks.reduce((sum, track) => sum + (track.analytics.completionRate || 0), 0) / tracks.length,
        topPerformingTracks: tracks
          .sort((a, b) => b.analytics.engagementScore - a.analytics.engagementScore)
          .slice(0, 3)
          .map(track => ({
            id: track._id,
            title: track.title,
            streams: track.analytics.totalStreams
          }))
      };

      return res.status(200).json({
        message: "Successfully retrieved release tracks",
        data: {
          tracks,
          releaseStats
        },
        meta: {
          sortBy: sort,
          totalTracks: tracks.length
        }
      });

    } catch (error) {
      console.error("Error in getTracksFromRelease:", error);
      return res.status(500).json({
        message: "Error fetching release tracks",
        error: error.message
      });
    }
  };

  // Get personalized recommendations for user dashboard
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

      let matchStage = {};
      let recommendationReason = "Popular tracks you might like";

      // If user has listening history, use it for personalization
      if (recentHistory.length > 0) {
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

        matchStage = {
          $or: [
            { "metadata.genre": { $in: topGenres } },
            { artistId: { $in: topArtistIds } }
          ]
        };
        recommendationReason = "Based on your recent listening";
      }

      // Get recommendations
      const recommendations = await Track.aggregate([
        {
          $match: {
            ...matchStage,
            // Exclude recently played tracks if any
            ...(recentHistory.length > 0 && {
              _id: {
                $nin: recentHistory.map(item => item.trackId)
              }
            })
          }
        },
        // Lookup necessary relations
        {
          $lookup: {
            from: "songs",
            localField: "songId",
            foreignField: "_id",
            as: "songData"
          }
        },
        {
          $unwind: "$songData"
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
        // Add engagement score for ranking
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ["$songData.analytics.totalStreams", 1] },
                { $multiply: ["$songData.analytics.playlistAdditions", 2] },
                { $multiply: ["$songData.analytics.shares.total", 1.5] },
                { $multiply: ["$songData.analytics.likes", 1.2] },
                // Boost recent releases
                {
                  $cond: {
                    if: {
                      $gte: [
                        "$release.dates.release_date",
                        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                      ]
                    },
                    then: 1000,
                    else: 0
                  }
                }
              ]
            }
          }
        },
        {
          $sort: { score: -1 }
        },
        {
          $limit: parseInt(limit)
        },
        // Project final shape
        {
          $project: {
            _id: 1,
            title: 1,
            duration: 1,
            trackNumber: "$track_number",
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            release: {
              _id: "$release._id",
              title: "$release.title",
              artwork: "$release.artwork.cover_image",
              type: "$release.type",
              releaseDate: "$release.dates.release_date"
            },
            genre: "$metadata.genre",
            analytics: {
              streams: "$songData.analytics.totalStreams",
              likes: "$songData.analytics.likes",
              shares: "$songData.analytics.shares.total"
            },
            recommendationReason
          }
        }
      ]);

      // If no recommendations found based on history, get trending tracks
      if (recommendations.length === 0) {
        const trendingTracks = await Track.aggregate([
          {
            $lookup: {
              from: "songs",
              localField: "songId",
              foreignField: "_id",
              as: "songData"
            }
          },
          {
            $unwind: "$songData"
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
            $match: {
              "release.dates.release_date": {
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $addFields: {
              score: {
                $add: [
                  "$songData.analytics.totalStreams",
                  { $multiply: ["$songData.analytics.playlistAdditions", 2] },
                  { $multiply: ["$songData.analytics.shares.total", 1.5] }
                ]
              }
            }
          },
          {
            $sort: { score: -1 }
          },
          {
            $limit: parseInt(limit)
          },
          {
            $project: {
              _id: 1,
              title: 1,
              duration: 1,
              trackNumber: "$track_number",
              artist: {
                _id: "$artist._id",
                name: "$artist.name",
                image: "$artist.profileImage"
              },
              release: {
                _id: "$release._id",
                title: "$release.title",
                artwork: "$release.artwork.cover_image",
                type: "$release.type",
                releaseDate: "$release.dates.release_date"
              },
              genre: "$metadata.genre",
              analytics: {
                streams: "$songData.analytics.totalStreams",
                likes: "$songData.analytics.likes",
                shares: "$songData.analytics.shares.total"
              },
              recommendationReason: "Trending tracks right now"
            }
          }
        ]);

        return res.status(200).json({
          message: "Successfully retrieved trending recommendations",
          data: trendingTracks
        });
      }

      return res.status(200).json({
        message: "Successfully retrieved personalized recommendations",
        data: recommendations
      });

    } catch (error) {
      console.error("Error in getDashboardRecommendations:", error);
      return res.status(500).json({
        message: "Error fetching dashboard recommendations",
        error: error.message
      });
    }
  };

  // Get new releases from followed artists
  const getFollowedArtistsReleases = async (req, res) => {
    try {
      const { userId } = req.params;
      const { days = 30, limit = 20 } = req.query;

      // Get user's followed artists
      const followedArtists = await Follow.find({
        userId: new mongoose.Types.ObjectId(userId)
      });

      let artistIds = followedArtists.map(follow => follow.artistId);

      // If user doesn't follow any artists, get trending artists
      if (artistIds.length === 0) {
        const trendingArtists = await Artist.aggregate([
          {
            $lookup: {
              from: "tracks",
              localField: "_id",
              foreignField: "artistId",
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
              totalStreams: {
                $sum: "$songs.analytics.totalStreams"
              }
            }
          },
          {
            $sort: { totalStreams: -1 }
          },
          {
            $limit: 10
          }
        ]);

        artistIds = trendingArtists.map(artist => artist._id);
      }

      // Get recent releases from artists
      const newReleases = await Release.aggregate([
        {
          $match: {
            artistId: { $in: artistIds },
            "dates.release_date": {
              $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
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
        },
        {
          $unwind: "$artist"
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
          $addFields: {
            totalTracks: { $size: "$tracks" }
          }
        },
        {
          $sort: { "dates.release_date": -1 }
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            _id: 1,
            title: 1,
            type: 1,
            releaseDate: "$dates.release_date",
            artwork: "$artwork.cover_image",
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            metadata: {
              genre: 1,
              totalTracks: "$totalTracks"
            },
            analytics: {
              totalStreams: 1,
              saves: 1
            }
          }
        }
      ]);

      // If no new releases, get trending releases
      if (newReleases.length === 0) {
        const trendingReleases = await Release.aggregate([
          {
            $match: {
              "dates.release_date": {
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
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
          },
          {
            $unwind: "$artist"
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
            $addFields: {
              totalTracks: { $size: "$tracks" },
              score: {
                $add: [
                  "$analytics.totalStreams",
                  { $multiply: ["$analytics.saves", 2] }
                ]
              }
            }
          },
          {
            $sort: { score: -1 }
          },
          {
            $limit: parseInt(limit)
          },
          {
            $project: {
              _id: 1,
              title: 1,
              type: 1,
              releaseDate: "$dates.release_date",
              artwork: "$artwork.cover_image",
              artist: {
                _id: "$artist._id",
                name: "$artist.name",
                image: "$artist.profileImage"
              },
              metadata: {
                genre: 1,
                totalTracks: "$totalTracks"
              },
              analytics: {
                totalStreams: 1,
                saves: 1
              }
            }
          }
        ]);

        return res.status(200).json({
          message: "Successfully retrieved trending releases",
          data: trendingReleases,
          source: "trending"
        });
      }

      return res.status(200).json({
        message: "Successfully retrieved new releases from followed artists",
        data: newReleases,
        source: "followed"
      });

    } catch (error) {
      console.error("Error in getFollowedArtistsReleases:", error);
      return res.status(500).json({
        message: "Error fetching followed artists' releases",
        error: error.message
      });
    }
  };

  // Get daily mix playlists based on user's listening habits
  const getDailyMixes = async (req, res) => {
    try {
      const { userId } = req.params;
      const { mixCount = 6, songsPerMix = 25 } = req.query;

      // Get user's listening history from last 90 days
      const listeningHistory = await LastPlayed.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: {
              $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
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

      let genresToUse = [];

      // If user has listening history, use their preferred genres
      if (listeningHistory.length > 0) {
        const genreGroups = listeningHistory.reduce((groups, item) => {
          if (item.track.metadata.genre) {
            item.track.metadata.genre.forEach(genre => {
              if (!groups[genre]) {
                groups[genre] = [];
              }
              groups[genre].push(item.track);
            });
          }
          return groups;
        }, {});

        genresToUse = Object.entries(genreGroups)
          .sort(([,a], [,b]) => b.length - a.length)
          .slice(0, parseInt(mixCount))
          .map(([genre]) => genre);
      }
      if (genresToUse.length === 0) {
        // Get most popular genres based on overall streaming data
        const popularGenres = await Track.aggregate([
          {
            $lookup: {
              from: "songs",
              localField: "songId",
              foreignField: "_id",
              as: "songData"
            }
          },
          {
            $unwind: "$songData"
          },
          {
            $group: {
              _id: "$metadata.genre",
              totalStreams: { $sum: "$songData.analytics.totalStreams" }
            }
          },
          {
            $sort: { totalStreams: -1 }
          },
          {
            $limit: parseInt(mixCount)
          }
        ]);

        genresToUse = popularGenres.map(genre => genre._id).flat();
      }

      // Generate mix for each genre
      const mixes = await Promise.all(genresToUse.map(async (genre) => {
        // Get top tracks for this genre
        const mixTracks = await Track.aggregate([
          {
            $match: {
              "metadata.genre": genre,
              // Exclude tracks from user's recent history if any
              ...(listeningHistory.length > 0 && {
                _id: {
                  $nin: listeningHistory.map(item => item.trackId)
                }
              })
            }
          },
          {
            $lookup: {
              from: "songs",
              localField: "songId",
              foreignField: "_id",
              as: "songData"
            }
          },
          {
            $unwind: "$songData"
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
          // Add engagement score for better track selection
          {
            $addFields: {
              score: {
                $add: [
                  { $multiply: ["$songData.analytics.totalStreams", 1] },
                  { $multiply: ["$songData.analytics.playlistAdditions", 2] },
                  { $multiply: ["$songData.analytics.likes", 1.5] },
                  // Boost recent releases
                  {
                    $cond: {
                      if: {
                        $gte: [
                          "$release.dates.release_date",
                          new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
                        ]
                      },
                      then: 500,
                      else: 0
                    }
                  }
                ]
              }
            }
          },
          {
            $sort: { score: -1 }
          },
          {
            $limit: parseInt(songsPerMix)
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
                type: "$release.type",
                releaseDate: "$release.dates.release_date"
              },
              analytics: {
                streams: "$songData.analytics.totalStreams",
                likes: "$songData.analytics.likes"
              }
            }
          }
        ]);

        // Get representative artwork for the mix
        const artworks = mixTracks
          .slice(0, 4)
          .map(track => track.release.artwork)
          .filter(Boolean);

        // Calculate mix stats
        const totalDuration = mixTracks.reduce((sum, track) => sum + track.duration, 0);
        const uniqueArtists = new Set(mixTracks.map(track => track.artist._id.toString())).size;

        return {
          id: new mongoose.Types.ObjectId(),
          name: `${genre} Mix`,
          description: listeningHistory.length > 0
            ? `A personalized mix of ${genre} music based on your listening history`
            : `Popular ${genre} tracks we think you'll love`,
          genre,
          artwork: {
            main: artworks[0] || null,
            mosaic: artworks
          },
          stats: {
            totalTracks: mixTracks.length,
            totalDuration,
            uniqueArtists
          },
          tracks: mixTracks,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          refreshAvailableAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
        };
      }));

      // Filter out any mixes that didn't get enough tracks
      const validMixes = mixes.filter(mix => mix.tracks.length >= 10);

      if (validMixes.length === 0) {
        // If no valid mixes, create a general top tracks mix
        const topTracks = await Track.aggregate([
          {
            $lookup: {
              from: "songs",
              localField: "songId",
              foreignField: "_id",
              as: "songData"
            }
          },
          {
            $unwind: "$songData"
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
              score: {
                $add: [
                  "$songData.analytics.totalStreams",
                  { $multiply: ["$songData.analytics.playlistAdditions", 2] },
                  { $multiply: ["$songData.analytics.likes", 1.5] }
                ]
              }
            }
          },
          {
            $sort: { score: -1 }
          },
          {
            $limit: parseInt(songsPerMix)
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
                type: "$release.type",
                releaseDate: "$release.dates.release_date"
              },
              analytics: {
                streams: "$songData.analytics.totalStreams",
                likes: "$songData.analytics.likes"
              }
            }
          }
        ]);

        const totalDuration = topTracks.reduce((sum, track) => sum + track.duration, 0);
        const uniqueArtists = new Set(topTracks.map(track => track.artist._id.toString())).size;

        validMixes.push({
          id: new mongoose.Types.ObjectId(),
          name: "Today's Top Hits",
          description: "The most popular tracks right now",
          artwork: {
            main: topTracks[0]?.release.artwork || null,
            mosaic: topTracks.slice(0, 4).map(track => track.release.artwork)
          },
          stats: {
            totalTracks: topTracks.length,
            totalDuration,
            uniqueArtists
          },
          tracks: topTracks,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          refreshAvailableAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
        });
      }

      return res.status(200).json({
        message: "Successfully generated daily mixes",
        data: {
          mixes: validMixes,
          meta: {
            source: listeningHistory.length > 0 ? 'personalized' : 'popular',
            totalMixes: validMixes.length,
            refreshAvailable: validMixes[0]?.refreshAvailableAt
          }
        }
      });

    } catch (error) {
      console.error("Error in getDailyMixes:", error);
      return res.status(500).json({
        message: "Error generating daily mixes",
        error: error.message
      });
    }
  };

  const getLastPlayed = async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        uniqueOnly = false // Option to show only unique songs
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build date filter
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }

      // Build the aggregation pipeline
      const pipeline = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
          }
        },
        {
          $sort: { timestamp: -1 }
        }
      ];

      // Add group stage if uniqueOnly is true
      if (uniqueOnly === 'true') {
        pipeline.push({
          $group: {
            _id: "$trackId",
            lastPlayed: { $first: "$timestamp" },
            deviceType: { $first: "$deviceType" },
            quality: { $first: "$quality" },
            completionRate: { $first: "$completionRate" }
          }
        });
      }

      // Continue with the rest of the pipeline
      pipeline.push(
        {
          $lookup: {
            from: "tracks",
            localField: uniqueOnly === 'true' ? "_id" : "trackId",
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
        // Lookup featured artists
        {
          $lookup: {
            from: "ft",
            localField: "track._id",
            foreignField: "trackId",
            as: "features"
          }
        },
        {
          $lookup: {
            from: "artists",
            localField: "features.artistId",
            foreignField: "_id",
            as: "featuredArtists"
          }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            _id: "$track._id",
            playedAt: "$timestamp",
            lastPlayed: "$lastPlayed", // For uniqueOnly mode
            track: {
              title: "$track.title",
              duration: "$track.duration",
              isExplicit: "$track.flags.isExplicit",
              trackNumber: "$track.track_number"
            },
            artist: {
              _id: "$artist._id",
              name: "$artist.name",
              image: "$artist.profileImage"
            },
            featuredArtists: {
              $map: {
                input: "$featuredArtists",
                as: "artist",
                in: {
                  _id: "$$artist._id",
                  name: "$$artist.name"
                }
              }
            },
            release: {
              _id: "$release._id",
              title: "$release.title",
              type: "$release.type",
              artwork: {
                high: "$release.artwork.cover_image.high",
                medium: "$release.artwork.cover_image.medium",
                low: "$release.artwork.cover_image.low",
                thumbnail: "$release.artwork.cover_image.thumbnail"
              },
              releaseDate: "$release.dates.release_date"
            },
            playbackInfo: {
              deviceType: "$deviceType",
              quality: "$quality",
              completionRate: "$completionRate"
            }
          }
        }
      );

      const [results, totalCount] = await Promise.all([
        LastPlayed.aggregate(pipeline),
        LastPlayed.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
          ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
        })
      ]);

      // Calculate listening statistics
      const stats = {
        totalTracks: totalCount,
        uniqueArtists: new Set(results.map(item => item.artist._id.toString())).size,
        uniqueReleases: new Set(results.map(item => item.release._id.toString())).size,
        completionRate: results.reduce((sum, item) => sum + (item.playbackInfo.completionRate || 0), 0) / results.length,
        deviceTypes: Object.entries(
          results.reduce((acc, item) => {
            acc[item.playbackInfo.deviceType] = (acc[item.playbackInfo.deviceType] || 0) + 1;
            return acc;
          }, {})
        ).map(([type, count]) => ({ type, count }))
      };

      return res.status(200).json({
        message: "Successfully retrieved listening history",
        data: results,
        stats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / parseInt(limit)),
          hasMore: totalCount > skip + results.length
        },
        meta: {
          uniqueOnly: uniqueOnly === 'true',
          dateRange: {
            start: startDate || 'all time',
            end: endDate || 'present'
          }
        }
      });

    } catch (error) {
      console.error("Error in getLastPlayed:", error);
      return res.status(500).json({
        message: "Error fetching listening history",
        error: error.message
      });
    }
  };

    // Export all functions
    module.exports = {
      getAllSongs,
      getSong,
      createRelease,
      streamSong,
      shareSong,
      addToPlaylist,
      getSongEngagementMetrics,
      toggleSavedRelease,
      getSavedReleases,
      getUserTopSongs,
      getUserListeningHistory,
      getUserListeningInsights,
      getTopSongs,
      getTrendingSongsByRegion,
      updateSongMetadata,
      getTopSongsForArtist,
      getAlbumsAndEpByArtist,
      getSingles,
      getTopSongsForArtist,
      getAlbumsAndEpByArtist,
      getSingles,
      getAllReleases,
      getRelease,
      getSearchSuggestions,
      getTracksFromRelease,
      getDashboardRecommendations,
      getFollowedArtistsReleases,
      getDailyMixes,
      getLastPlayed
    };
