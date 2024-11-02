const PlayListName = require("../models/playlistnames.model");
const PlayListSongs = require("../models/playlistsongs.model");
const Song = require("../models/song.model");
const Track = require("../models/track.model");
const { generateCoverImage } = require("../utils/helpers/coverImageGenerator");

const getAllPlayList = async (req, res) => {
  try {
    const playListSongs = await PlayListName.find({})
      .sort({ createdDate: -1 }); // Sort by creation date, newest first

    return res.status(200).json({
      message: "Successfully retrieved all playlists",
      data: playListSongs,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching playlists",
      error: error.message,
    });
  }
};

const getAllPlayListForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required"
      });
    }

    const playLists = await PlayListName.aggregate([
      {
        $match: {
          userId: userId
        },
      },
      {
        $lookup: {
          from: "playlistsongs",
          localField: "_id",
          foreignField: "playlistId",
          as: "songs"
        },
      },
      {
        $sort: {
          isPinned: -1,  // Show pinned playlists first
          lastModified: -1 // Then sort by last modified
        }
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved user playlists",
      data: playLists,
      totalPlaylists: playLists.length
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user playlists",
      error: error.message,
    });
  }
};

const getPlayListSongs = async (req, res) => {
  try {
    const { playlistId } = req.params;

    if (!playlistId) {
      return res.status(400).json({
        message: "Playlist ID is required"
      });
    }

    const playlist = await PlayListName.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              { $toObjectId: playlistId }
            ],
          },
        },
      },
      {
        $lookup: {
          from: "playlistsongs",
          localField: "_id",
          foreignField: "playlistId",
          as: "songs",
          pipeline: [
            {
              $lookup: {
                from: "tracks",
                localField: "trackId",
                foreignField: "_id",
                as: "trackDetails"
              }
            },
            {
              $unwind: "$trackDetails"
            },
            {
              $sort: { order: 1 } // Sort songs by their order in the playlist
            }
          ]
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          userId: 1,
          coverImage: 1,
          isPublic: 1,
          isPinned: 1,
          totalTracks: 1,
          totalDuration: 1,
          lastModified: 1,
          songs: {
            _id: 1,
            trackId: 1,
            order: 1,
            addedAt: 1,
            addedBy: 1,
            trackDetails: {
              _id: 1,
              title: 1,
              duration: 1,
              artist: 1,
              albumId: 1
            }
          }
        }
      }
    ]);

    if (!playlist || playlist.length === 0) {
      return res.status(404).json({
        message: "Playlist not found"
      });
    }

    return res.status(200).json({
      message: "Successfully retrieved playlist and songs",
      data: playlist[0]
    });
  } catch (error) {
    console.error("Error fetching playlist songs:", error);
    return res.status(500).json({
      message: "Error fetching playlist songs",
      error: error.message
    });
  }
};

const createPlaylist = async (req, res) => {
  try {
    const { title, userId, description, isPublic, isCollaborative } = req.body;

    // Validation
    if (!title || !userId) {
      return res.status(400).json({
        message: "Title and userId are required fields"
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        message: "Playlist title must be 100 characters or less"
      });
    }

     // Create new playlist
     const newPlaylist = new PlayListName({
       title,
       userId,
       description: description || "",
       isPublic: isPublic || false,
       isCollaborative: isCollaborative || false,
       createdDate: Date.now(),
       lastModified: Date.now(),
       genreDistribution: new Map(),
       totalTracks: 0,
       totalDuration: 0
     });

    await newPlaylist.save();

    return res.status(201).json({
      message: "Playlist created successfully",
      data: newPlaylist
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return res.status(500).json({
      message: "Error creating playlist",
      error: error.message
    });
  }
};

const updatePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { title, description, isPublic, isCollaborative } = req.body;
    const userId = req.body.userId; // Assuming you're passing userId in the request

    // Find playlist and check ownership
    const playlist = await PlayListName.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({
        message: "Playlist not found"
      });
    }

    // Check if user owns the playlist or is a collaborator
    if (playlist.userId !== userId && !playlist.collaborators.includes(userId)) {
      return res.status(403).json({
        message: "You don't have permission to modify this playlist"
      });
    }

    // Update fields
    const updates = {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(isPublic !== undefined && { isPublic }),
      ...(isCollaborative !== undefined && { isCollaborative }),
      lastModified: Date.now()
    };

    const updatedPlaylist = await PlayListName.findByIdAndUpdate(
      playlistId,
      updates,
      { new: true }
    );

    return res.status(200).json({
      message: "Playlist updated successfully",
      data: updatedPlaylist
    });
  } catch (error) {
    console.error("Error updating playlist:", error);
    return res.status(500).json({
      message: "Error updating playlist",
      error: error.message
    });
  }
};

const deletePlayList = async (req, res) => {
  try {
    const { playlistId, userId } = req.body;

    // Validate input
    if (!playlistId || !userId) {
      return res.status(400).json({
        message: "Playlist ID and user ID are required"
      });
    }

    // Check playlist ownership
    const playlist = await PlayListName.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({
        message: "Playlist not found"
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        message: "You don't have permission to delete this playlist"
      });
    }

    // Delete playlist and its songs
    await Promise.all([
      PlayListName.findByIdAndDelete(playlistId),
      PlayListSongs.deleteMany({ playlistId: playlistId }),
    ]);

    return res.status(200).json({
      message: "Playlist deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    return res.status(500).json({
      message: "Error deleting playlist",
      error: error.message
    });
  }
};

const togglePinPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { userId } = req.body;

    // Validate ownership
    const playlist = await PlayListName.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({
        message: "Playlist not found"
      });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({
        message: "You don't have permission to pin this playlist"
      });
    }

    // Toggle pin status
    const updatedPlaylist = await PlayListName.findByIdAndUpdate(
      playlistId,
      [
        {
          $set: {
            isPinned: { $not: "$isPinned" },
            lastModified: Date.now()
          }
        }
      ],
      { new: true }
    );

    return res.status(200).json({
      message: updatedPlaylist.isPinned ? "Playlist pinned successfully" : "Playlist unpinned successfully",
      data: updatedPlaylist
    });
  } catch (error) {
    console.error("Error toggling playlist pin status:", error);
    return res.status(500).json({
      message: "Error updating playlist pin status",
      error: error.message
    });
  }
};

module.exports = {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSongs,
  createPlaylist,
  updatePlaylist,
  deletePlayList,
  addSongToPlaylist,
  togglePinPlaylist,
};
