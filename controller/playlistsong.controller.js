const PlayListName = require("../models/playlistnames.model");
const PlayListSongs = require("../models/playlistsongs.model");
const Release = require("../models/releases.model");
const Song = require("../models/song.model");
const Track = require("../models/track.model");
const User = require("../models/user.model");
const { generateCoverImage } = require("../utils/helpers/coverImageGenerator");

const getAllPlayList = async (req, res) => {
  try {
    const playListSongs = await PlayListName.find({});

    return res.status(200).json({
      message: "successfully get all Play list songs",
      data: playListSongs,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching play list songs",
      error: error.message,
    });
  }
};

const getAllPlayListForUser = async (req, res) => {
  try {
    const playListSongs = await PlayListName.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$userId", req.params.userId],
          },
        },
      },
      {
        $lookup: {
          from: "playlistsongs",
          localField: "_id",
          foreignField: "playlistId",
          as: "playlistsongs",
        },
      },
    ]);

    return res.status(200).json({
      message: "successfully gotten all user play list songs",
      data: playListSongs,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching play list songs",
      error: error.message,
    });
  }
};

const getPlayListSong = async (req, res) => {
  try {
    const playlist = await PlayListName.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.playlistId,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "playlistsongs",
          localField: "_id",
          foreignField: "playlistId",
          as: "playlistsongs",
        },
      },
    ]);

    if (!playlist) {
      return res.status(404).json({ message: "playlist not found" });
    }

    return res.status(200).json({
      message: "successfully gotten user playlist",
      data: playlist[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching preference", error: error.message });
  }
};

  const createPlaylist = async (req, res) => {
    try {
      const { title, userId } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Create new playlist with minimal required info
      const newPlaylist = new PlayListName({
        title,
        userId,
        coverImage: generateCoverImage(0), // Start with default empty playlist cover
        lastModified: Date.now()
      });

      await newPlaylist.save();

      return res.status(201).json({
        message: "Playlist created successfully",
        data: newPlaylist
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Error creating playlist",
        error: error.message
      });
    }
  }

const addSongToPlaylist = async (req, res) => {
    try {
      const { tracks, playlistId, userId } = req.body;

      // Input validation
      if (!tracks || !playlistId || !userId) {
        return res.status(400).json({
          message: "Missing required fields: tracks, playlistId, and userId are required"
        });
      }

      // Convert single track to array and ensure all IDs are strings
      const trackIds = (Array.isArray(tracks) ? tracks : [tracks])
        .map(id => id.toString());

      console.log("Processing track IDs:", trackIds);

      // First, validate the playlist exists
      const playlist = await PlayListName.findById(playlistId);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Check permissions
      if (!playlist.isCollaborative && playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this playlist" });
      }

      // Get existing songs for order calculation
      const existingSongs = await PlayListSongs.find({ playlistId }).sort({ order: -1 });
      let nextOrder = existingSongs.length > 0 ? existingSongs[0].order + 1 : 1;

      // Find existing tracks in playlist
      const existingTrackIds = await PlayListSongs.distinct('trackId', {
        playlistId,
        trackId: { $in: trackIds },
        isHidden: false
      });

      const existingTrackSet = new Set(existingTrackIds.map(id => id.toString()));

      // Fetch all valid tracks
      const tracksInfo = await Track.find({
        '_id': { $in: trackIds }
      }).populate('genreId');

      console.log("Found tracks:", tracksInfo.length);

      // Validate all tracks were found
      if (tracksInfo.length === 0) {
        return res.status(404).json({
          message: "No valid tracks found"
        });
      }

      // Keep track of which tracks weren't found
      const foundTrackIds = new Set(tracksInfo.map(track => track._id.toString()));
      const notFoundTracks = trackIds.filter(id => !foundTrackIds.has(id));

      if (notFoundTracks.length > 0) {
        console.log("Tracks not found:", notFoundTracks);
      }

      // Get current genre distribution
      let genreDistribution = new Map(playlist.genreDistribution);

      // Prepare bulk operations
      const songsBulkOps = [];
      const trackUpdateOps = [];
      const addedTracks = [];
      const skippedTracks = [];
      let totalDurationAdded = 0;

      for (const track of tracksInfo) {
        const trackIdStr = track._id.toString();

        if (!existingTrackSet.has(trackIdStr)) {
          // Prepare new playlist song entry
          songsBulkOps.push({
            insertOne: {
              document: {
                trackId: track._id,
                userId: playlist.userId,
                playlistId,
                addedBy: userId,
                order: nextOrder++,
                addedAt: new Date()
              }
            }
          });

          // Update genre distribution if genre exists
          if (track.genreId) {
            const currentCount = genreDistribution.get(track.genreId.toString()) || 0;
            genreDistribution.set(track.genreId.toString(), currentCount + 1);
          }

          addedTracks.push({
            id: track._id,
            title: track.title
          });
          totalDurationAdded += track.duration || 0;

          // Prepare track update for playlistAdditions increment
          if (track.songId) {
            trackUpdateOps.push({
              updateOne: {
                filter: { _id: track.songId },
                update: { $inc: { playlistAdditions: 1 } }
              }
            });
          }
        } else {
          skippedTracks.push({
            id: track._id,
            title: track.title,
            reason: "Already in playlist"
          });
        }
      }

      // If no valid tracks to add, return early
      if (addedTracks.length === 0) {
        return res.status(200).json({
          message: "No new tracks were added to playlist",
          data: {
            addedTracks: [],
            skippedTracks,
            notFoundTracks,
            playlistUpdates: null
          }
        });
      }

      // Find dominant genre
      let dominantGenre = null;
      let maxCount = 0;
      for (const [genreId, count] of genreDistribution) {
        if (count > maxCount) {
          maxCount = count;
          dominantGenre = genreId;
        }
      }

      // Generate new cover image
      const newCoverImage = generateCoverImage(existingSongs.length + addedTracks.length);

      // Perform all database operations
      try {
        await Promise.all([
          // Only perform bulk operations if there are items to process
          songsBulkOps.length > 0 ?
            PlayListSongs.bulkWrite(songsBulkOps) :
            Promise.resolve(),

          trackUpdateOps.length > 0 ?
            Song.bulkWrite(trackUpdateOps) :
            Promise.resolve(),

          PlayListName.findByIdAndUpdate(playlistId, {
            $inc: {
              totalTracks: addedTracks.length,
              totalDuration: totalDurationAdded
            },
            $set: {
              lastModified: Date.now(),
              coverImage: newCoverImage,
              dominantGenre: dominantGenre,
              genreDistribution: Object.fromEntries(genreDistribution)
            }
          })
        ]);
      } catch (dbError) {
        console.error("Database operation failed:", dbError);
        return res.status(500).json({
          message: "Failed to update playlist",
          error: dbError.message
        });
      }

      // Prepare response message
      let message = "";
      if (addedTracks.length > 0 && skippedTracks.length > 0) {
        message = `Added ${addedTracks.length} tracks. Skipped ${skippedTracks.length} duplicate tracks.`;
      } else if (addedTracks.length > 0) {
        message = `Successfully added ${addedTracks.length} tracks to playlist.`;
      }

      if (notFoundTracks.length > 0) {
        message += ` ${notFoundTracks.length} tracks were not found.`;
      }

      return res.status(200).json({
        message,
        data: {
          addedTracks,
          skippedTracks,
          notFoundTracks,
          playlistUpdates: {
            coverImage: newCoverImage,
            dominantGenre,
            totalTracks: existingSongs.length + addedTracks.length,
            totalDuration: totalDurationAdded
          }
        }
      });

    } catch (error) {
      console.error("Error in addSongToPlaylist:", error);
      return res.status(500).json({
        message: "Error adding songs to playlist",
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

const deletePlayList = async (req, res) => {
  try {
    const { playlistId } = req.body;

    await Promise.all([
      PlayListName.findByIdAndDelete(playlistId),
      PlayListSongs.deleteMany({ playlistId: playlistId }),
    ]);

    return res.status(200).json({
      message: "successfully deleted playlist",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error deleting playlist", error: error.message });
  }
};

const pinnPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;

    const noOfPlaylists = await PlayListName.find({
      _id: playlistId,
      isPinned: true,
    });

    if (noOfPlaylists.length == 5) {
      return res.status(400).json({ message: "Already reached max" });
    }

    const id = await PlayListName.findByIdAndUpdate(playlistId, {
      $set: { isPinned: true },
    });

    console.log(id);
    return res.status(200).json({
      message: "successfully pinned playlist",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error deleting playlist", error: error.message });
  }
};

module.exports = {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSong,
  createPlaylist,
  deletePlayList,
  addSongToPlaylist,
  pinnPlaylist,
};
