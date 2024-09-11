const PlayListName = require("../models/playlistnames.model");
const PlayListSongs = require("../models/playlistsongs.model");
const Release = require("../models/releases.model");

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
    const { title, description, userId, image, coverImage, genreId, isPublic } =
      req.body;

    if (title == "" || description == "" || image == "" || coverImage == "") {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newPlaylist = new PlayListName({
      title,
      description,
      userId,
      image,
      coverImage,
      genreId,
      isPublic,
    });

    await newPlaylist.save();

    return res.status(200).json({
      message: "successfully created a playlist",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating playlist", error: error.message });
  }
};

const addSongToPlaylist = async (req, res) => {
  try {
    const { releaseId, playlistId } = req.body;

    const playlist = await PlayListName.findById(playlistId);
    const song = await Release.findById(releaseId);

    if (!playlist) {
      return res.status(401).json({ message: "Playlist not found" });
    }

    if (!song) {
      return res.status(401).json({ message: "release not found" });
    }

    const newSongToPlaylist = new PlayListSongs({
      releaseId,
      userId: playlist.userId,
      playlistId,
    });

    await newSongToPlaylist.save();

    return res.status(200).json({
      message: "successfully added song playlist",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error adding song to playlist", error: error.message });
  }
};

const deletePlayList = async (req, res) => {
  try {
    const preference = await PlayListSongs.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.id,
              },
            ],
          },
        },
      },
    ]);

    if (!preference) {
      return res.status(404).json({ message: "Preference not found" });
    }

    return res.status(200).json({
      message: "successfully gotten user preference",
      data: preference[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching preference", error: error.message });
  }
};

module.exports = {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSong,
  createPlaylist,
  deletePlayList,
  addSongToPlaylist,
};
