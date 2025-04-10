import mongoose from "mongoose";
import { Song } from "../models/song.model.js";
import { Release } from "../models/releases.model.js";
import { Track } from "../models/track.model.js";
// import { Genre } from "../models/genre.model.js";
import { Artist } from "../models/artist.model.js";
import { Follow } from "../models/followers.model.js";
import { LastPlayed } from "../models/lastplayed.model.js";
import { FT } from "../models/ft.model.js";
import { SavedRelease } from "../models/savedalbums.model.js";
// import { LikeTracks } from "../models/liketracks.model.js";
// import { matchUser } from "../utils/helpers/searchquery.js";
import { transformTrackData } from "../utils/helpers/transformData.js";

import { UploadVerification } from "../models/songuploadverification.model.js";
import { validateFile } from '../utils/helpers/fileValidation.js';
import { uploadConfig } from '../utils/helpers/upload.config.js';

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
export const getAllSongs = async (req, res) => {
  try {
    // Add initial check for songs
    const songCount = await Song.countDocuments();
    console.log('Total songs in database:', songCount);

    const {
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    // Now try the aggregation
    const songs = await Song.aggregate([
      {
        $lookup: {
          from: 'tracks',
          localField: '_id',
          foreignField: 'songId',
          as: 'track'
        }
      },
      {
        $unwind: {
          path: '$track',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'releases',
          localField: 'track.releaseId',
          foreignField: '_id',
          as: 'release'
        }
      },
      {
        $unwind: {
          path: '$release',
          preserveNullAndEmptyArrays: true
        }
      },
      // Add match stage here to filter only approved releases
      {
        $match: {
          'release.verificationStatus': 'approved'
        }
      },
      {
        $lookup: {
          from: 'artists',
          localField: 'release.artistId',
          foreignField: '_id',
          as: 'artist'
        }
      },
      {
        $unwind: {
          path: '$artist',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          fileUrl: 1,
          duration: 1,
          format: 1,
          bitrate: 1,
          analytics: 1,
          waveform: 1,
          track: {
            _id: '$track._id',
            title: '$track.title',
            trackNumber: '$track.track_number',
            isExplicit: '$track.flags.isExplicit'
          },
          release: {
            _id: '$release._id',
            title: '$release.title',
            type: '$release.type',
            coverImage: '$release.artwork.cover_image',
            releaseDate: '$release.dates.release_date',
            verificationStatus: '$release.verificationStatus'
          },
          artist: {
            _id: '$artist._id',
            name: '$artist.name',
            imageUrl: '$artist.imageUrl'
          },
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: (Number(page) - 1) * Number(limit)
      },
      {
        $limit: Number(limit)
      }
    ]);

    // Get total count of approved songs
    const totalCount = await Song.aggregate([
      {
        $lookup: {
          from: 'tracks',
          localField: '_id',
          foreignField: 'songId',
          as: 'track'
        }
      },
      {
        $unwind: '$track'
      },
      {
        $lookup: {
          from: 'releases',
          localField: 'track.releaseId',
          foreignField: '_id',
          as: 'release'
        }
      },
      {
        $unwind: '$release'
      },
      {
        $match: {
          'release.verificationStatus': 'approved'
        }
      },
      {
        $count: 'total'
      }
    ]);

    const total = totalCount.length > 0 ? totalCount[0].total : 0;

    return res.status(200).json({
      status: 'success',
      data: songs,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    console.error('Error in getAllSongs:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};



export const getSong = async (req, res) => {
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
export const createRelease = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const todayUploads = await Song.countDocuments({
      'createdAt': {
        $gte: new Date().setHours(0, 0, 0, 0)
      }
    });

    if (todayUploads >= uploadConfig.maxDailyUploads) {
      throw new Error(`Daily upload limit of ${uploadConfig.maxDailyUploads} reached`);
    }
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


    const parsedReleaseDate = new Date(release_date);
    if (isNaN(parsedReleaseDate.getTime())) {
        throw new Error("Invalid release date format");
    }

    // Create release
    const release = new Release({
      title,
      artistId,
      type,


      dates: {
        release_date: parsedReleaseDate,
        announcement_date: new Date()
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
      },
      verificationStatus: 'pending',
      moderationNotes: null,
      verifiedAt: null
    });



    const songsToSave = [];
    const tracksToSave = [];
    const featuredArtists = [];

    // Process each song
    for (let i = 0; i < parsedSongs.length; i++) {
      const songData = parsedSongs[i];

       // Validate the song file
       const fileValidation = await validateFile(songData.fileUrl);

       if (!fileValidation.valid) {
         await session.abortTransaction();
         session.endSession();
         return res.status(400).json({
           message: "File validation failed",
           error: fileValidation.error
         });
       }

       // Create song using validated metadata
       const song = new Song({
         fileUrl: songData.fileUrl,
         duration: fileValidation.metadata.duration,
         bitrate: fileValidation.metadata.bitrate,
         format: fileValidation.metadata.format.toLowerCase() === "mpeg" ? "mp3" : fileValidation.metadata.format || "mp3",

         metadata: {
           fileHash: fileValidation.metadata.fileHash, // Store file hash
         },
         analytics: {
           totalStreams: 0,
           uniqueListeners: 0,
           playlistAdditions: 0,
           shares: { total: 0, platforms: {} }
         },
         flags: {
           isExplicit: songData.isExplicit || false,
           isInstrumental: songData.isInstrumental || false,
           hasLyrics: songData.hasLyrics !== false
         }
       });
       const verification = new UploadVerification({
        songId: song._id,
        releaseId: release._id,
        status: 'pending',
        metadata: {
          title: songData.title,
          duration: song.duration,
          format: song.format
        }
      });

      songsToSave.push(song);
      verificationRecords.push(verification);


       // Create track
       const track = new Track({
         releaseId: release._id,
         songId: song._id,
         title: songData.title,
         duration: fileValidation.metadata.duration, // Use validated duration
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

       // Process featured artists
       if (Array.isArray(songData.featuredArtists) && songData.featuredArtists.length > 0) {
         for (const feature of songData.featuredArtists) {
           if (!feature.artistId) {
             throw new Error(`Missing artistId for featured artist in song: ${songData.title}`);
           }

           const ftArtist = new FT({
             trackId: track._id,
             artistId: feature.artistId,
             contribution: feature.contribution || "vocals",
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
       message: "Release created and pending verification",
       data: {
         releaseId: release._id,
         status: "pending"
       }
     });

   } catch (error) {
     await session.abortTransaction();
     return res.status(500).json({
       message: "Error creating release",
       error: error.message
     });
   } finally {
     session.endSession();
   }
 };


 // apprive or rject a release
 export const verifyRelease = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { releaseId } = req.params;
    const { status, moderationNotes } = req.body;
    // const moderatorId = req.user._id;

    // Find release and validate
    const release = await Release.findById(releaseId).session(session);
    if (!release) {
      throw new Error('Release not found');
    }

    // Update release status
    const updatedRelease = await Release.findByIdAndUpdate(
      releaseId,
      {
        verificationStatus: status,
        moderationNotes,
        // moderatorId,
        verifiedAt: new Date(),
      },
      { session, new: true }
    );

    // If approved, update all associated tracks and songs
    if (status === 'approved') {
      await Track.updateMany(
        { releaseId },
        { status: 'active' },
        { session }
      );
    }

    await session.commitTransaction();
    return res.status(200).json({
      message: `Release ${status}`,
      data: updatedRelease
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Error verifying release",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// New endpoints for verification workflow
export const verifyUpload = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { verificationId } = req.params;
    const { status, moderationNotes } = req.body;
    const moderatorId = req.user._id;

    const verification = await UploadVerification.findById(verificationId);
    if (!verification) {
      throw new Error('Verification record not found');
    }

    // Check retry limits for rejected uploads
    if (status === 'rejected' && verification.retryCount >= uploadConfig.maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    const updatedVerification = await UploadVerification.findByIdAndUpdate(
      verificationId,
      {
        status,
        moderatorId,
        moderationNotes,
        verifiedAt: new Date(),
        $inc: { retryCount: status === 'rejected' ? 1 : 0 }
      },
      { session, new: true }
    );

    await session.commitTransaction();
    return res.status(200).json({
      message: `Upload ${status}`,
      data: updatedVerification
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Error during verification",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get verification status
export const getVerificationStatus = async (req, res) => {
  try {
    const { songId } = req.params;
    const verification = await UploadVerification.findOne({ songId })
      .populate('moderatorId', 'username email');

    if (!verification) {
      return res.status(404).json({
        message: "Verification record not found"
      });
    }

    return res.status(200).json({
      message: "Verification status retrieved",
      data: verification
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching verification status",
      error: error.message
    });
  }
};

// Resubmit rejected upload
export const resubmitUpload = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { songId } = req.params;
    const { newFile } = req.body;

    const verification = await UploadVerification.findOne({ songId });
    if (!verification) {
      throw new Error('Verification record not found');
    }

    if (verification.retryCount >= uploadConfig.maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    // Validate new file
    const fileValidation = await validateFile(newFile);
    if (!fileValidation.isValid) {
      throw new Error(`File validation failed: ${fileValidation.errors.join(', ')}`);
    }

    // Update song and verification records
    await Song.findByIdAndUpdate(songId, {
      fileUrl: newFile.path,
      'metadata.fileHash': fileValidation.metadata.fileHash
    }, { session });

    await UploadVerification.findByIdAndUpdate(verification._id, {
      status: 'pending',
      moderationNotes: null,
      verifiedAt: null,
      'metadata.fileHash': fileValidation.metadata.fileHash
    }, { session });

    await session.commitTransaction();
    return res.status(200).json({
      message: "Upload resubmitted successfully",
      status: 'pending'
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      message: "Error resubmitting upload",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};


// Analytics and Interactions
export const streamSong = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { songId, userId, } = req.params;
    const { completionRate = 0, timestamp, offline = false, deviceType = 'unknown', quality = 'standard', region = 'unknown' } = req.body;

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

export const shareSong = async (req, res) => {
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

export const addToPlaylist = async (req, res) => {
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
    })
  } finally {
    session.endSession();
  }
};

export const getTopSongs = async (req, res) => {
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

export const getTrendingSongsByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const { timeframe = '24h', limit = 50 } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '24h': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
    }

    const trendingSongs = await Track.aggregate([
      // First get tracks and their associated data
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
      // Get release data
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
      // Get artist data
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
      // Match streams from specified region and timeframe
      {
        $match: {
          "songData.streamHistory": {
            $elemMatch: {
              region: region,
              timestamp: { $gte: startDate, $lte: endDate }
            }
          }
        }
      },
      // Calculate trending metrics
      {
        $addFields: {
          recentStreams: {
            $size: {
              $filter: {
                input: "$songData.streamHistory",
                cond: {
                  $and: [
                    { $eq: ["$$this.region", region] },
                    { $gte: ["$$this.timestamp", startDate] },
                    { $lte: ["$$this.timestamp", endDate] }
                  ]
                }
              }
            }
          },
          recentShares: {
            $size: {
              $filter: {
                input: "$songData.shareHistory",
                cond: {
                  $and: [
                    { $eq: ["$$this.region", region] },
                    { $gte: ["$$this.timestamp", startDate] },
                    { $lte: ["$$this.timestamp", endDate] }
                  ]
                }
              }
            }
          },
          // Calculate trending score based on multiple factors
          trendingScore: {
            $add: [
              // Recent streams are weighted heavily
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: "$songData.streamHistory",
                        cond: {
                          $and: [
                            { $eq: ["$$this.region", region] },
                            { $gte: ["$$this.timestamp", startDate] },
                            { $lte: ["$$this.timestamp", endDate] }
                          ]
                        }
                      }
                    }
                  },
                  3 // Weight for streams
                ]
              },
              // Playlist additions indicate growing popularity
              {
                $multiply: [
                  "$songData.analytics.playlistAdditions",
                  2 // Weight for playlist adds
                ]
              },
              // Shares indicate viral potential
              {
                $multiply: [
                  "$songData.analytics.shares.total",
                  2.5 // Weight for shares
                ]
              },
              // Likes show user engagement
              {
                $multiply: [
                  "$songData.analytics.likes",
                  1.5 // Weight for likes
                ]
              },
              // Bonus for high completion rates
              {
                $multiply: [
                  { $avg: "$songData.streamHistory.completionRate" },
                  0.5 // Weight for completion rate
                ]
              }
            ]
          }
        }
      },
      // Sort by trending score
      {
        $sort: { trendingScore: -1 }
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
          artist: {
            _id: "$artist._id",
            name: "$artist.name",
            image: "$artist.profileImage",
            verified: "$artist.verified"
          },
          release: {
            _id: "$release._id",
            title: "$release.title",
            artwork: "$release.artwork.cover_image",
            releaseDate: "$release.dates.release_date"
          },
          analytics: {
            streams: {
              total: "$songData.analytics.totalStreams",
              recent: "$recentStreams"
            },
            shares: {
              total: "$songData.analytics.shares.total",
              recent: "$recentShares"
            },
            playlists: "$songData.analytics.playlistAdditions",
            likes: "$songData.analytics.likes"
          },
          trendingScore: 1,
          trendingRank: {
            $add: [{ $indexOfArray: ["$trendingScore", "$trendingScore"] }, 1]
          }
        }
      }
    ]);

    // Calculate trending percentage changes
    const enhancedTrendingSongs = trendingSongs.map(song => ({
      ...song,
      analytics: {
        ...song.analytics,
        trends: {
          streams: {
            percentage: calculatePercentageChange(
              song.analytics.streams.total - song.analytics.streams.recent,
              song.analytics.streams.recent
            )
          },
          shares: {
            percentage: calculatePercentageChange(
              song.analytics.shares.total - song.analytics.shares.recent,
              song.analytics.shares.recent
            )
          }
        }
      }
    }));

    return res.status(200).json({
      message: "Successfully retrieved trending songs",
      data: enhancedTrendingSongs,
      meta: {
        region,
        timeframe,
        totalTracks: enhancedTrendingSongs.length,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error("Error in getTrendingSongsByRegion:", error);
    return res.status(500).json({
      message: "Error fetching trending songs",
      error: error.message
    });
  }
};

// Metadata Management
export const updateSongMetadata = async (req, res) => {
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
export const getSongEngagementMetrics = async (req, res) => {
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
export const toggleSavedRelease = async (req, res) => {
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
export const getSavedReleases = async (req, res) => {
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
          as: "releaseData"
        }
      },
      {
        $unwind: "$releaseData"
      },
      {
        $lookup: {
          from: "artists",
          localField: "releaseData.artistId",
          foreignField: "_id",
          as: "artistData"
        }
      },
      {
        $unwind: "$artistData"
      },
      {
        $lookup: {
          from: "tracks",
          localField: "releaseData._id",
          foreignField: "releaseId",
          as: "tracks"
        }
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
    ]).then(releases => releases.map(transformTrackData));

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
export const getUserTopSongs = async (req, res) => {
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
export const getUserListeningHistory = async (req, res) => {
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
export const getUserListeningInsights = async (req, res) => {
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

export const getTopSongsForArtist = async (req, res) => {
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
export const getAlbumsAndEpByArtist = async (req, res) => {
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
export const getSingles = async (req, res) => {
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

export const getAllReleases = async (req, res) => {
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
export const getRelease = async (req, res) => {
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
export const getSearchSuggestions = async (req, res) => {
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

export const getTracksFromRelease = async (req, res) => {
    try {
      const { releaseId } = req.params;
      const { sort = 'track_number', idType } = req.query;

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(releaseId)) {
        return res.status(400).json({
          message: "Invalid ID format"
        });
      }

      // Define sort options
      const sortOptions = {
        track_number: { "track_number": 1 },
        popularity: { "analytics.totalStreams": -1 },
        title: { "title": 1 },
        duration: { "duration": 1 }
      };

      // Determine the type of ID if not explicitly provided
      let determinedIdType = idType;
      let matchStage = {};
      let isSingleTrack = false;

      if (!determinedIdType) {
        // Try to determine the ID type by checking different collections
        const isTrack = await Track.findById(releaseId);
        const isRelease = !isTrack ? await Release.findById(releaseId) : null;

        if (!isTrack && !isRelease) {
          return res.status(404).json({
            message: "No track or release found with this ID"
          });
        }

        if (isTrack) {
          determinedIdType = 'track';
          isSingleTrack = true;
        } else if (isRelease) {
          determinedIdType = isRelease.type || 'release';
        }
      } else if (determinedIdType === 'track') {
        isSingleTrack = true;
      }

      // Build match stage based on ID type
      if (isSingleTrack) {
        matchStage = { _id: new mongoose.Types.ObjectId(releaseId) };
      } else {
        matchStage = { releaseId: new mongoose.Types.ObjectId(releaseId) };
      }

      const tracks = await Track.aggregate([
        {
          $match: matchStage
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
          $unwind: {
            path: "$songData",
            preserveNullAndEmptyArrays: true
          }
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
        // Calculate engagement metrics
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $multiply: [{ $ifNull: ["$songData.analytics.totalStreams", 0] }, 1] },
                { $multiply: [{ $ifNull: ["$songData.analytics.playlistAdditions", 0] }, 2] },
                { $multiply: [{ $ifNull: ["$songData.analytics.shares.total", 0] }, 3] },
                { $multiply: [{ $ifNull: ["$songData.analytics.likes", 0] }, 1.5] }
              ]
            },
            completionRate: {
              $cond: {
                if: { $gt: [{ $ifNull: ["$interactions.totalStreams", 0] }, 0] },
                then: {
                  $multiply: [
                    { $divide: [{ $ifNull: ["$interactions.totalCompletionRate", 0] }, { $ifNull: ["$interactions.totalStreams", 1] }] },
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
              totalStreams: { $ifNull: ["$songData.analytics.totalStreams", 0] },
              uniqueListeners: { $ifNull: ["$songData.analytics.uniqueListeners", 0] },
              completionRate: "$completionRate",
              skipRate: {
                $multiply: [
                  { $divide: [{ $ifNull: ["$interactions.skipCount", 0] }, { $max: [{ $ifNull: ["$interactions.totalStreams", 1] }, 1] }] },
                  100
                ]
              },
              playlist: {
                total: { $ifNull: ["$songData.analytics.playlistAdditions", 0] },
                editorial: { $ifNull: ["$releaseData.analytics.playlists.editorial", 0] }
              },
              shares: "$songData.analytics.shares",
              likes: { $ifNull: ["$songData.analytics.likes", 0] },
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
          message: isSingleTrack ? "Track not found" : "No tracks found for this release"
        });
      }

      // Calculate release-level statistics (only for release types, not for single track)
      let releaseStats = null;
      if (!isSingleTrack) {
        releaseStats = {
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
      }

      return res.status(200).json({
        message: isSingleTrack
          ? "Successfully retrieved track"
          : "Successfully retrieved release tracks",
        data: isSingleTrack
          ? tracks[0]
          : {
              tracks,
              releaseStats
            },
        meta: {
          idType: determinedIdType,
          sortBy: sort,
          totalTracks: tracks.length
        }
      });

    } catch (error) {
      console.error("Error in getTracksFromRelease:", error);
      return res.status(500).json({
        message: "Error fetching tracks",
        error: error.message
      });
    }
  };

// Get personalized recommendations for user dashboard
export const getDashboardRecommendations = async (req, res) => {
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
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([genre]) => genre);

      const topArtistIds = Object.entries(favoriteArtists)
        .sort(([, a], [, b]) => b - a)
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
export const getFollowedArtistsReleases = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30, limit = 10, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const releaseTimeframe = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // First get the artists that the user follows
    const followedArtists = await Follow.find({
      userId: new mongoose.Types.ObjectId(userId)
    }).select('artistId');

    const artistIds = followedArtists.map(follow => follow.artistId);

    // If user follows artists, get their recent releases
    let releases = [];
    let source = 'followed';

    if (artistIds.length > 0) {
      releases = await Release.aggregate([
        {
          $match: {
            artistId: { $in: artistIds },
            'dates.release_date': { $gte: releaseTimeframe }
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
            daysAgo: {
              $dateDiff: {
                startDate: "$dates.release_date",
                endDate: "$$NOW",
                unit: "day"
              }
            }
          }
        },
        {
          $sort: { "dates.release_date": -1 }
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
            releaseDate: "$dates.release_date",
            artwork: "$artwork.cover_image",
            daysAgo: 1,
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
            },
            commercial: {
              label: 1
            }
          }
        }
      ]);
    }

    // If no releases from followed artists, get trending releases
    if (releases.length === 0) {
      releases = await Release.aggregate([
        {
          $match: {
            'dates.release_date': { $gte: releaseTimeframe }
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
            daysAgo: {
              $dateDiff: {
                startDate: "$dates.release_date",
                endDate: "$$NOW",
                unit: "day"
              }
            },
            score: {
              $add: [
                "$analytics.totalStreams",
                { $multiply: ["$analytics.saves", 2] },
                { $multiply: ["$analytics.shares.total", 1.5] },
                { $multiply: ["$analytics.playlists.total", 2] }
              ]
            }
          }
        },
        {
          $sort: { score: -1, "dates.release_date": -1 }
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
            releaseDate: "$dates.release_date",
            artwork: "$artwork.cover_image",
            daysAgo: 1,
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
            },
            commercial: {
              label: 1
            },
            score: 1
          }
        }
      ]);

      source = 'trending';
    }

    // Get total count for pagination
    const totalCount = await Release.countDocuments(
      source === 'followed'
        ? {
          artistId: { $in: artistIds },
          'dates.release_date': { $gte: releaseTimeframe }
        }
        : {
          'dates.release_date': { $gte: releaseTimeframe }
        }
    );

    // Group releases by time period
    const groupedReleases = {
      today: [],
      thisWeek: [],
      thisMonth: []
    };

    releases.forEach(release => {
      if (release.daysAgo === 0) {
        groupedReleases.today.push(release);
      } else if (release.daysAgo <= 7) {
        groupedReleases.thisWeek.push(release);
      } else {
        groupedReleases.thisMonth.push(release);
      }
    });

    return res.status(200).json({
      message: "Successfully retrieved releases",
      data: {
        releases: groupedReleases,
        timeline: {
          today: groupedReleases.today.length,
          thisWeek: groupedReleases.thisWeek.length,
          thisMonth: groupedReleases.thisMonth.length
        }
      },
      pagination: {
        current: parseInt(page),
        total: Math.ceil(totalCount / parseInt(limit)),
        hasMore: totalCount > (skip + releases.length)
      },
      meta: {
        source,
        timeframe: `${days} days`,
        followedArtists: artistIds.length,
        totalReleases: releases.length
      }
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
export const getDailyMixes = async (req, res) => {
    try {
      const { userId } = req.params;
      const { mixCount = 6, songsPerMix = 25 } = req.query;

      // Get followed artists using correct field names
      const followedArtists = await Follow.find({
        follower: new mongoose.Types.ObjectId(userId)
      })
      .populate({
        path: 'following',
        model: 'artist',
        select: '_id name profileImage followers monthlyListeners'
      });

      // If no followed artists, return appropriate response
      if (!followedArtists.length) {
        return res.status(200).json({
          message: "No mixes available - follow some artists to get personalized mixes",
          data: { mixes: [] }
        });
      }

      // Select random artists from followed artists up to mixCount
      const selectedArtists = followedArtists
        .sort(() => 0.5 - Math.random())
        .slice(0, parseInt(mixCount));

      // Generate mix for each selected artist
      const mixes = await Promise.all(selectedArtists.map(async ({ following: artist }) => {
        // Get top tracks for this artist
        const mixTracks = await Track.aggregate([
          {
            $match: {
              artistId: artist._id
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
            $addFields: {
              score: {
                $add: [
                  { $multiply: [{ $ifNull: ["$songData.analytics.totalStreams", 0] }, 1] },
                  { $multiply: [{ $ifNull: ["$songData.analytics.playlistAdditions", 0] }, 2] },
                  { $multiply: [{ $ifNull: ["$songData.analytics.likes", 0] }, 1.5] }
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
                _id: artist._id,
                name: artist.name,
                image: artist.profileImage
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

        // Calculate mix stats
        const totalDuration = mixTracks.reduce((sum, track) => sum + (track.duration || 0), 0);

        return {
          id: new mongoose.Types.ObjectId(),
          name: `${artist.name} Mix`,
          description: `A personalized mix featuring ${artist.name}'s top tracks`,
          artwork: artist.profileImage,
          stats: {
            totalTracks: mixTracks.length,
            totalDuration,
            artist: {
              name: artist.name,
              followers: artist.followers,
              monthlyListeners: artist.monthlyListeners
            }
          },
          tracks: mixTracks,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          refreshAvailableAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
        };
      }));

      // Filter out any mixes that didn't get enough tracks
      const validMixes = mixes.filter(mix => mix.tracks.length > 0);

      return res.status(200).json({
        message: "Successfully generated artist mixes",
        data: {
          mixes: validMixes,
          meta: {
            source: 'followed_artists',
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

export const getLastPlayed = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      uniqueOnly = false,
      includeStats = true
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const dateFilter = {};

    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // First pipeline to get recent tracks with context
    const recentTracksPipeline = [
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

    if (uniqueOnly === 'true') {
      recentTracksPipeline.push({
        $group: {
          _id: "$trackId",
          lastPlayed: { $first: "$timestamp" },
          deviceType: { $first: "$deviceType" },
          quality: { $first: "$quality" },
          completionRate: { $first: "$completionRate" },
          playCount: { $sum: 1 }
        }
      });
    }

    recentTracksPipeline.push(
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
          from: "songs",
          localField: "track.songId",
          foreignField: "_id",
          as: "song"
        }
      },
      {
        $unwind: "$song"
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
      }
    );

    // Get listening statistics if requested
    let stats = {};
    if (includeStats === 'true') {
      const statsPipeline = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
          }
        },
        {
          $group: {
            _id: null,
            totalPlaytime: {
              $sum: {
                $multiply: [
                  { $divide: ["$completionRate", 100] },
                  "$track.duration"
                ]
              }
            },
            totalTracks: { $sum: 1 },
            uniqueTracks: { $addToSet: "$trackId" },
            uniqueArtists: { $addToSet: "$track.artistId" },
            uniqueReleases: { $addToSet: "$track.releaseId" },
            avgCompletionRate: { $avg: "$completionRate" },
            devices: { $addToSet: "$deviceType" },
            qualities: { $addToSet: "$quality" }
          }
        },
        {
          $project: {
            _id: 0,
            totalPlaytime: 1,
            totalTracks: 1,
            uniqueTracks: { $size: "$uniqueTracks" },
            uniqueArtists: { $size: "$uniqueArtists" },
            uniqueReleases: { $size: "$uniqueReleases" },
            avgCompletionRate: 1,
            devices: 1,
            qualities: 1
          }
        }
      ];

      const statsResult = await LastPlayed.aggregate(statsPipeline);
      stats = statsResult[0] || {};
    }

    const [results, totalCount] = await Promise.all([
      LastPlayed.aggregate(recentTracksPipeline),
      LastPlayed.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        ...(Object.keys(dateFilter).length && { timestamp: dateFilter })
      })
    ]);

    // Transform results for response
    const transformedResults = results.map(item => ({
      _id: item.track._id,
      playedAt: uniqueOnly === 'true' ? item.lastPlayed : item.timestamp,
      track: {
        title: item.track.title,
        duration: item.track.duration,
        isExplicit: item.track.flags.isExplicit,
        trackNumber: item.track.track_number,
        analytics: {
          streams: item.song.analytics.totalStreams,
          likes: item.song.analytics.likes
        }
      },
      artist: {
        _id: item.artist._id,
        name: item.artist.name,
        image: item.artist.profileImage
      },
      featuredArtists: item.featuredArtists.map(artist => ({
        _id: artist._id,
        name: artist.name
      })),
      release: {
        _id: item.release._id,
        title: item.release.title,
        type: item.release.type,
        artwork: item.release.artwork.cover_image,
        releaseDate: item.release.dates.release_date
      },
      playbackInfo: {
        deviceType: item.deviceType,
        quality: item.quality,
        completionRate: item.completionRate,
        ...(uniqueOnly === 'true' && { playCount: item.playCount })
      }
    }));

    return res.status(200).json({
      message: "Successfully retrieved listening history",
      data: transformedResults,
      ...(includeStats === 'true' && { stats }),
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

export const getLocationBasedTracks = async (req, res) => {
  try {
    const { countryCode, limit = 30, timeframe = '30d' } = req.query;

    if (!countryCode) {
      return res.status(400).json({
        message: "Country code is required"
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '24h': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
    }

    const tracks = await Track.aggregate([
      // Join with songs collection
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
      // Join with releases
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
      // Join with artists
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
      // Calculate regional metrics
      {
        $addFields: {
          regionalMetrics: {
            recentStreams: {
              $size: {
                $filter: {
                  input: "$songData.streamHistory",
                  cond: {
                    $and: [
                      { $eq: ["$$this.region", countryCode] },
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
      // Calculate comprehensive score
      {
        $addFields: {
          score: {
            $add: [
              // Recent streams in region (highest weight)
              { $multiply: ["$regionalMetrics.recentStreams", 4] },
              // Total streams
              { $multiply: ["$songData.analytics.totalStreams", 2] },
              // Playlist additions (good indicator of popularity)
              { $multiply: ["$songData.analytics.playlistAdditions", 3] },
              // Shares (viral potential)
              { $multiply: ["$songData.analytics.shares.total", 2] },
              // Likes
              { $multiply: ["$songData.analytics.likes", 1] },
              // Bonus for new releases (last 30 days)
              {
                $cond: {
                  if: {
                    $gte: [
                      "$release.dates.release_date",
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
      // Filter for minimum engagement
      {
        $match: {
          $or: [
            { "regionalMetrics.recentStreams": { $gt: 0 } },
            { "songData.analytics.totalStreams": { $gt: 100 } },
            { "songData.analytics.playlistAdditions": { $gt: 5 } }
          ]
        }
      },
      // Sort by score
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
            songdata: {
              _id: "$songData._id",
              fileUrl: "$songData.fileUrl",
              format: "$songData.format",
              bitrate: "$songData.bitrate",
            },
            analytics: {
              totalStreams: "$songData.analytics.totalStreams",
              regionalStreams: "$regionalMetrics.recentStreams",
              playlists: "$songData.analytics.playlistAdditions",
              shares: "$songData.analytics.shares.total",
              likes: "$songData.analytics.likes"
            },
            metadata: {
              genre: "$metadata.genre",
              isrc: "$metadata.isrc",
              language: "$metadata.languageCode"
            },
            score: 1
          }
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved location-based tracks",
      data: tracks,
      meta: {
        country: countryCode,
        timeframe,
        dateRange: {
          start: startDate,
          end: endDate
        },
        totalTracks: tracks.length
      }
    });

  } catch (error) {
    console.error("Error in getLocationBasedTracks:", error);
    return res.status(500).json({
      message: "Error fetching location-based tracks",
      error: error.message
    });
  }
};

// Get worldwide top songs
export const getWorldwideTopSongs = async (req, res) => {
  try {
    const { timeframe = '24h', limit = 30, offset = 0 } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
      case '24h': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
    }

    const pipeline = [
      // Get all tracks
      {
        $lookup: {
          from: "songs",
          localField: "songId",
          foreignField: "_id",
          as: "song"
        }
      },
      {
        $unwind: "$song"
      },
      // Get release data
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
      // Get artist data
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
      // Calculate recent streams globally
      {
        $addFields: {
          recentStreams: {
            $size: {
              $filter: {
                input: { $ifNull: ["$song.streamHistory", []] },
                as: "stream",
                cond: {
                  $and: [
                    { $gte: ["$$stream.timestamp", startDate] },
                    { $lte: ["$$stream.timestamp", endDate] }
                  ]
                }
              }
            }
          }
        }
      },
      // Calculate global popularity score
      {
        $addFields: {
          globalScore: {
            $add: [
              // Recent streams (highest weight)
              { $multiply: [{ $ifNull: ["$recentStreams", 0] }, 4] },
              // Total streams
              { $multiply: [{ $ifNull: ["$song.analytics.totalStreams", 0] }, 2] },
              // Playlist additions
              { $multiply: [{ $ifNull: ["$song.analytics.playlistAdditions", 0] }, 3] },
              // Shares
              { $multiply: [{ $ifNull: ["$song.analytics.shares.total", 0] }, 2] },
              // New release bonus
              {
                $cond: {
                  if: {
                    $gte: [
                      "$release.dates.release_date",
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
      // Sort by global popularity
      {
        $sort: {
          globalScore: -1,
          "release.dates.release_date": -1
        }
      },
      {
        $skip: parseInt(offset)
      },
      {
        $limit: parseInt(limit)
      },
      // Final shape
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
              releaseDate: "$release.dates.release_date"
            },
            songdata: {
              _id: "$song._id",
              fileUrl: "$song.fileUrl",
              format: "$song.format",
              bitrate: "$song.bitrate",
            },
            analytics: {
              totalStreams: { $ifNull: ["$song.analytics.totalStreams", 0] },
              recentStreams: "$recentStreams",
              shares: { $ifNull: ["$song.analytics.shares.total", 0] },
              playlists: { $ifNull: ["$song.analytics.playlistAdditions", 0] }
            },
            metadata: {
              genre: "$metadata.genre",
              isrc: "$metadata.isrc",
              language: "$metadata.languageCode"
            },
            globalScore: 1
          }
      }
    ];

    const [tracks, total] = await Promise.all([
      Track.aggregate(pipeline),
      Track.countDocuments()
    ]);

    // Add ranks after aggregation
    const rankedTracks = tracks.map((track, index) => ({
      ...track,
      rank: index + 1
    }));

    return res.status(200).json({
      message: "Successfully retrieved worldwide top songs",
      data: rankedTracks,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total,
        hasMore: total > (parseInt(offset) + tracks.length)
      },
      meta: {
        timeframe,
        dateRange: {
          start: startDate,
          end: endDate
        },
        totalTracks: tracks.length
      }
    });

  } catch (error) {
    console.error("Error in getWorldwideTopSongs:", error);
    return res.status(500).json({
      message: "Error fetching worldwide top songs",
      error: error.message
    });
  }
};
