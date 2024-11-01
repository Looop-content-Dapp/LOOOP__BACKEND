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

const addSongToPlaylist = async(req, res) => {
    try {
      const { trackId, playlistId, userId } = req.body;

      const [playlist, track, existingSongs] = await Promise.all([
        PlayListName.findById(playlistId),
        Track.findById(trackId).populate('genreId'),
        PlayListSongs.find({ playlistId }).sort({ order: -1 })
      ]);

      // Validation checks
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }

      // Check permissions
      if (!playlist.isCollaborative && playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this playlist" });
      }

      // Check if song already exists in playlist
      const songExists = await PlayListSongs.findOne({
        playlistId,
        trackId,
        isHidden: false
      });

      if (songExists) {
        return res.status(400).json({ message: "Song already exists in this playlist" });
      }

      // Calculate next order number
      const nextOrder = existingSongs.length > 0 ? existingSongs[0].order + 1 : 1;

      const newSongToPlaylist = new PlayListSongs({
        trackId,
        userId: playlist.userId,
        playlistId,
        addedBy: userId,
        order: nextOrder
      });

      // Update genre distribution
      let genreDistribution = new Map(playlist.genreDistribution);
      const currentCount = genreDistribution.get(track.genreId.toString()) || 0;
      genreDistribution.set(track.genreId.toString(), currentCount + 1);

      // Find dominant genre
      let dominantGenre = null;
      let maxCount = 0;
      for (const [genreId, count] of genreDistribution) {
        if (count > maxCount) {
          maxCount = count;
          dominantGenre = genreId;
        }
      }

      // Generate new cover image based on total songs
      const newCoverImage = generateCoverImage(existingSongs.length + 1);

      // Update playlist metadata
      await Promise.all([
        newSongToPlaylist.save(),
        PlayListName.findByIdAndUpdate(playlistId, {
          $inc: { totalTracks: 1, totalDuration: track.duration },
          $set: {
            lastModified: Date.now(),
            coverImage: newCoverImage,
            dominantGenre: dominantGenre,
            genreDistribution: Object.fromEntries(genreDistribution)
          }
        }),
        Song.findByIdAndUpdate(track.songId, {
          $inc: { playlistAdditions: 1 }
        })
      ]);

      return res.status(200).json({
        message: "Song added to playlist successfully",
        data: {
          song: newSongToPlaylist,
          playlistUpdates: {
            coverImage: newCoverImage,
            dominantGenre: dominantGenre,
            totalTracks: existingSongs.length + 1
          }
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Error adding song to playlist",
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
