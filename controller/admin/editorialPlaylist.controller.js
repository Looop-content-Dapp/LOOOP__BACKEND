import { PlayListName } from "../../models/playlistnames.model.js";
import { PlayListSongs } from "../../models/playlistsongs.model.js";

export const createEditorialPlaylist = async (req, res) => {
  try {
    const { title, description, tracks, coverImage } = req.body;
    const adminId = req.user._id; // From auth middleware

    if (!title || !tracks || !Array.isArray(tracks)) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["title", "tracks (array)"]
      });
    }

    // Create editorial playlist
    const playlist = await PlayListName.create({
      title,
      description,
      coverImage,
      userId: adminId,
      isEditorial: true,
      isPublic: true,
      type: "EDITORIAL",
      createdAt: new Date(),
      lastModified: new Date()
    });

    // Add tracks to playlist
    const playlistTracks = tracks.map((trackId, index) => ({
      playlistId: playlist._id,
      trackId,
      addedBy: adminId,
      position: index,
      addedAt: new Date()
    }));

    await PlayListSongs.insertMany(playlistTracks);

    return res.status(201).json({
      message: "Editorial playlist created successfully",
      data: {
        playlistId: playlist._id,
        title: playlist.title,
        trackCount: tracks.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating editorial playlist",
      error: error.message
    });
  }
};

export const updateEditorialPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { title, description, tracks, coverImage } = req.body;
    const adminId = req.user._id;

    const playlist = await PlayListName.findOne({
      _id: playlistId,
      isEditorial: true
    });

    if (!playlist) {
      return res.status(404).json({
        message: "Editorial playlist not found"
      });
    }

    // Update playlist details
    if (title) playlist.title = title;
    if (description) playlist.description = description;
    if (coverImage) playlist.coverImage = coverImage;
    playlist.lastModified = new Date();

    await playlist.save();

    // Update tracks if provided
    if (tracks && Array.isArray(tracks)) {
      await PlayListSongs.deleteMany({ playlistId });

      const playlistTracks = tracks.map((trackId, index) => ({
        playlistId: playlist._id,
        trackId,
        addedBy: adminId,
        position: index,
        addedAt: new Date()
      }));

      await PlayListSongs.insertMany(playlistTracks);
    }

    return res.status(200).json({
      message: "Editorial playlist updated successfully",
      data: {
        playlistId: playlist._id,
        title: playlist.title,
        trackCount: tracks ? tracks.length : undefined
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating editorial playlist",
      error: error.message
    });
  }
};
