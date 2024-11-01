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

      const [isUserPremium, userPlaylist] = await Promise.all([
        User.findById(userId),
        PlayListName.find({ userId: userId })
      ]);

      // Free users can only create 2 playlists
      if (userPlaylist.length === 2 && !isUserPremium.isPremium) {
        return res.status(403).json({
          message: "Free users can only create two playlists. Upgrade to Premium for unlimited playlists."
        });
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

      // Convert single track to array for consistent processing
      const trackIds = Array.isArray(tracks) ? tracks : [tracks];

      const playlist = await PlayListName.findById(playlistId);

      // Validation checks
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Check permissions
      if (!playlist.isCollaborative && playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this playlist" });
      }

      // Get existing songs and their count for ordering
      const existingSongs = await PlayListSongs.find({ playlistId }).sort({ order: -1 });
      let nextOrder = existingSongs.length > 0 ? existingSongs[0].order + 1 : 1;

      // Get current genre distribution
      let genreDistribution = new Map(playlist.genreDistribution);

      // Process all tracks
      const addedTracks = [];
      const skippedTracks = [];
      let totalDurationAdded = 0;

      // Fetch all tracks info at once
      const tracksInfo = await Track.find({
        '_id': { $in: trackIds }
      }).populate('genreId');

      // Check which tracks already exist in playlist
      const existingTrackIds = await PlayListSongs.distinct('trackId', {
        playlistId,
        trackId: { $in: trackIds },
        isHidden: false
      });

      const existingTrackSet = new Set(existingTrackIds.map(id => id.toString()));

      // Prepare bulk operations
      const songsBulkOps = [];
      const trackUpdateOps = [];

      for (const track of tracksInfo) {
        if (!existingTrackSet.has(track._id.toString())) {
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

          // Update genre distribution
          const currentCount = genreDistribution.get(track.genreId.toString()) || 0;
          genreDistribution.set(track.genreId.toString(), currentCount + 1);

          // Track successful additions
          addedTracks.push(track._id);
          totalDurationAdded += track.duration;

          // Prepare track update for playlistAdditions increment
          trackUpdateOps.push({
            updateOne: {
              filter: { _id: track.songId },
              update: { $inc: { playlistAdditions: 1 } }
            }
          });
        } else {
          skippedTracks.push(track._id);
        }
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

      // Generate new cover image based on updated total songs
      const newCoverImage = generateCoverImage(existingSongs.length + addedTracks.length);

      // Perform all database operations in parallel
      await Promise.all([
        // Bulk insert new songs if any
        songsBulkOps.length > 0 ?
          PlayListSongs.bulkWrite(songsBulkOps) :
          Promise.resolve(),

        // Update tracks' playlistAdditions if any
        trackUpdateOps.length > 0 ?
          Song.bulkWrite(trackUpdateOps) :
          Promise.resolve(),

        // Update playlist metadata
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

      // Prepare response message based on results
      let message = "";
      if (addedTracks.length > 0 && skippedTracks.length > 0) {
        message = `Added ${addedTracks.length} tracks. Skipped ${skippedTracks.length} duplicate tracks.`;
      } else if (addedTracks.length > 0) {
        message = `Successfully added ${addedTracks.length} tracks to playlist.`;
      } else {
        message = "No new tracks were added. All tracks already exist in playlist.";
      }

      return res.status(200).json({
        message,
        data: {
          addedTracks,
          skippedTracks,
          playlistUpdates: {
            coverImage: newCoverImage,
            dominantGenre,
            totalTracks: existingSongs.length + addedTracks.length,
            totalDuration: totalDurationAdded
          }
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Error adding songs to playlist",
        error: error.message
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
