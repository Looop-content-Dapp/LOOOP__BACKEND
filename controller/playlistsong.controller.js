// import { Track } from "../models/track.model";
import { PlayListName } from "../models/playlistnames.model.js";
import { PlayListSongs } from "../models/playlistsongs.model.js";
import { transformTrackData } from "../utils/helpers/transformData.js";

// Helper function to generate a simple color-based cover
const generateCoverImage = () => {
  const colors = [
    '#1DB954', '#1ED760', '#2D46B9', '#509BF5',
    '#B49BC8', '#E91429', '#F037A5'
  ];
  return "https://i.pinimg.com/564x/66/39/19/66391940e99ae6e58a0478b9c23f333d.jpg";
};

// Get all playlists (public)
export const getAllPlayList = async (req, res) => {
  try {

    PlayListName
    return res.status(200).json({
      message: "Successfully retrieved public playlists",
      data: playLists,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching playlists",
      error: error.message,
    });
  }
};

export const getAllPlayListForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required"
      });
    }

    const playlists = await PlayListName.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $lookup: {
          from: "playlistsongs",
          localField: "_id",
          foreignField: "playlistId",
          as: "songs"
        }
      },
      {
        $lookup: {
          from: "tracks",
          localField: "songs.trackId",
          foreignField: "_id",
          as: "trackDetails"
        }
      },
      {
        $lookup: {
          from: "artists",
          localField: "trackDetails.artistId",
          foreignField: "_id",
          as: "artistData"
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackDetails.releaseId",
          foreignField: "_id",
          as: "releaseData"
        }
      },
      {
        $sort: {
          isPinned: -1,
          lastModified: -1
        }
      }
    ]).then(playlists => {
      return playlists.map(playlist => ({
        ...playlist,
        songs: playlist.songs.map(transformTrackData)
      }));
    });

    return res.status(200).json({
      message: "Successfully retrieved user playlists",
      data: playlists,
      totalPlaylists: playlists.length
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching user playlists",
      error: error.message
    });
  }
};

// Get a specific playlist with its songs
export const getPlayListSongs = async (req, res) => {
    try {
      const { playlistId } = req.params;

      if (!playlistId) {
        return res.status(400).json({
          message: "Playlist ID is required"
        });
      }

      // Aggregate playlist and songs
      const playlistAgg = await PlayListName.aggregate([
        {
          $match: {
            $expr: {
              $eq: ["$_id", { $toObjectId: playlistId }],
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
                  as: "trackDetails",
                  pipeline: [
                    {
                      $lookup: {
                        from: "songs",
                        localField: "songId",
                        foreignField: "_id",
                        as: "songData"
                      }
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
                      $lookup: {
                        from: "artists",
                        localField: "artistId",
                        foreignField: "_id",
                        as: "artistData"
                      }
                    },
                    {
                      $addFields: {
                        song: { $arrayElemAt: ["$songData", 0] },
                        release: { $arrayElemAt: ["$releaseData", 0] },
                        artist: { $arrayElemAt: ["$artistData", 0] }
                      }
                    },
                    {
                      $project: {
                        _id: 1,
                        title: 1,
                        duration: "$song.duration",
                        songData: { // Ensure songData is returned as an object
                          _id: "$song._id",
                          fileUrl: "$song.fileUrl",
                          format: "$song.format",
                          bitrate: "$song.bitrate"
                        },
                        releaseImage: {
                          $ifNull: [
                            "$release.artwork.cover_image.high",
                            "$release.artwork.cover_image.medium"
                          ]
                        },
                        artist: {
                          _id: "$artist._id",
                          name: "$artist.name",
                          imageUrl: "$artist.imageUrl"
                        }
                      }
                    }
                  ]
                }
              },
              { $unwind: "$trackDetails" },
              {
                $addFields: {
                  addedAt: "$addedAt",
                  addedBy: "$userId"
                }
              },
              { $sort: { addedAt: -1 } }
            ]
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            coverImage: 1,
            songs: 1
          }
        }
      ]);

      if (!playlistAgg || playlistAgg.length === 0) {
        return res.status(404).json({
          message: "Playlist not found"
        });
      }

      const playlist = playlistAgg[0];

      // Get number of saves (number of users who saved this playlist)
      const numberOfSaves = await PlayListSongs.countDocuments({ playlistId });
      const numberOfSongs = playlist.songs.length;

      // Format songs array
      const formattedSongs = playlist.songs.map(song => ({
        _id: song.trackDetails._id,
        title: song.trackDetails.title,
        duration: song.trackDetails.duration,
        songData: song.trackDetails.songData[0],
        releaseImage: song.trackDetails.releaseImage,
        artist: song.trackDetails.artist
      }));
      console.log("formmated", formattedSongs)

      // Calculate total duration
      const totalDuration = formattedSongs.reduce(
        (sum, song) => sum + (song.duration || 0), 0
      );

      // Build response
      const response = {
        _id: playlist._id,
        title: playlist.title,
        coverImage: playlist.coverImage,
        numberOfSaves,
        numberOfSongs,
        totalDuration, // <-- Added total duration here
        songs: formattedSongs
      };
    //   console.log("formmated", response)

      return res.status(200).json({
        message: "Successfully retrieved playlist and songs",
        data: response
      });
    } catch (error) {
      return res.status(500).json({
        message: "Error fetching playlist",
        error: error.message
      });
    }
  };

// Create a new playlist
export const createPlaylist = async (req, res) => {
  try {
    const { title, userId, description, isPublic, isCollaborative } = req.body;

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

    const newPlaylist = new PlayListName({
      title,
      userId,
      description: description || "",
      isPublic: isPublic || false,
      isCollaborative: isCollaborative || false,
      coverImage: "",
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

// Add song(s) to playlist.js
export const addSongToPlaylist = async (req, res) => {
    try {
      const { tracks, playlistIds, userId } = req.body;

      if (!tracks || !playlistIds || !userId) {
        return res.status(400).json({
          message: "Missing required fields: tracks, playlistIds, and userId are required"
        });
      }

      const trackIds = (Array.isArray(tracks) ? tracks : [tracks])
        .map(id => id.toString());

      const playlistIdArray = (Array.isArray(playlistIds) ? playlistIds : [playlistIds])
        .map(id => id.toString());

      let totalAddedTracks = 0;

      for (const playlistId of playlistIdArray) {
        const playlist = await PlayListName.findById(playlistId);
        if (!playlist) {
          return res.status(404).json({ message: `Playlist not found for ID: ${playlistId}` });
        }

        if (!playlist.isCollaborative && playlist.userId !== userId) {
          return res.status(403).json({ message: "Not authorized to modify this playlist" });
        }

        // Get existing songs
        const existingSongs = await PlayListSongs.find({ playlistId });
        const existingTrackIds = new Set(existingSongs.map(song => song.trackId.toString()));

        // Filter out duplicates
        const newTrackIds = trackIds.filter(id => !existingTrackIds.has(id));

        if (newTrackIds.length > 0) {
          // Add new songs
          const songsToAdd = newTrackIds.map(trackId => ({
            trackId,
            playlistId,
            userId,
            addedAt: new Date()
          }));

          await PlayListSongs.insertMany(songsToAdd);

          // Update playlist
          await PlayListName.findByIdAndUpdate(playlistId, {
            $inc: { totalTracks: newTrackIds.length },
            lastModified: Date.now()
          });

          totalAddedTracks += newTrackIds.length;
        }
      }

      return res.status(200).json({
        message: `Successfully added ${totalAddedTracks} tracks to playlists`,
        data: { addedTracks: totalAddedTracks }
      });
    } catch (error) {
      console.error("Error adding songs:", error);
      return res.status(500).json({
        message: "Error adding songs to playlists",
        error: error.message
      });
    }
  };

// Remove song from playlist
export const removeSongFromPlaylist = async (req, res) => {
  try {
    const { playlistId, trackId, userId } = req.body;

    if (!playlistId || !trackId || !userId) {
      return res.status(400).json({
        message: "PlaylistId, trackId, and userId are required"
      });
    }

    const playlist = await PlayListName.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (!playlist.isCollaborative && playlist.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this playlist" });
    }

    await PlayListSongs.findOneAndDelete({
      playlistId,
      trackId
    });

    await PlayListName.findByIdAndUpdate(playlistId, {
      $inc: { totalTracks: -1 },
      lastModified: Date.now()
    });

    return res.status(200).json({
      message: "Successfully removed track from playlist"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error removing track from playlist",
      error: error.message
    });
  }
};

// Update playlist details
export const updatePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { title, description, isPublic, isCollaborative, userId } = req.body;

    const playlist = await PlayListName.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this playlist" });
    }

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
    return res.status(500).json({
      message: "Error updating playlist",
      error: error.message
    });
  }
};

// Delete playlist
export const deletePlayList = async (req, res) => {
  try {
    const { playlistId, userId } = req.body;

    if (!playlistId || !userId) {
      return res.status(400).json({
        message: "PlaylistId and userId are required"
      });
    }

    const playlist = await PlayListName.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this playlist" });
    }

    await Promise.all([
      PlayListName.findByIdAndDelete(playlistId),
      PlayListSongs.deleteMany({ playlistId })
    ]);

    return res.status(200).json({
      message: "Playlist deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting playlist",
      error: error.message
    });
  }
};

// Toggle playlist pin status
export const togglePinPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { userId } = req.body;

    const playlist = await PlayListName.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to pin this playlist" });
    }

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
    return res.status(500).json({
      message: "Error updating playlist pin status",
      error: error.message
    });
  }
};
