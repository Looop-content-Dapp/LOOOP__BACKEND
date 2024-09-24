const Song = require("../models/song.model");
const Release = require("../models/releases.model");
const Track = require("../models/track.model");
const Genre = require("../models/genre.model");
const Preferences = require("../models/Preferences");

const getAllSongs = async (req, res) => {
  try {
    const Songs = await Song.find();

    return res.status(200).json({
      message: "successfully get all Songs",
      data: Songs,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching Songs", error: error.message });
  }
};

let releaseObject = [
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
    $group: {
      _id: "$_id",
      tracklists: { $push: "$tracklists" },
      otherFields: { $first: "$$ROOT" }, // Keep other fields from the original document
    },
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: ["$otherFields", { tracklists: "$tracklists" }],
      },
    },
  },
];

const getAllReleases = async (req, res) => {
  try {
    const Releases = await Release.aggregate([
      // First $lookup to populate the tracklists array with tracks
      ...releaseObject,
    ]);

    return res.status(200).json({
      message: "successfully get all releases",
      data: Releases,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching Releases", error: error.message });
  }
};

const getSong = async (req, res) => {
  try {
    const song = await Song.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.songId,
              },
            ],
          },
        },
      },
      //   {
      //     $lookup: {
      //       from: "preferences",
      //       localField: "_id",
      //       foreignField: "SongId",
      //       as: "preferences",
      //     },
      //   },
    ]);

    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }
    return res.status(200).json({
      message: "successfully gotten a Song",
      data: song[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching Song", error: error.message });
  }
};

const getRelease = async (req, res) => {
  try {
    const Song = await Release.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.releaseId,
              },
            ],
          },
        },
      },
      ...releaseObject,
    ]);

    if (!Song) {
      return res.status(404).json({ message: "Song not found" });
    }
    return res.status(200).json({
      message: "successfully gotten a Song",
      data: Song[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching Song", error: error.message });
  }
};

const getReleaseBasedOnGenres = async (req, res) => {
  try {
    const userGenres = await Preferences.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$userId",
              {
                $toObjectId: req.params.userId,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "genres",
          localField: "genreId",
          foreignField: "_id",
          as: "genre",
        },
      },
      {
        $unwind: "$genre",
      },
    ]);

    let newArr = [];

    userGenres.forEach((genre) => {
      newArr.push(genre.genre.name);
    });

    console.log(userGenres);

    const Song = await Release.aggregate([
      ...releaseObject,
      {
        $match: {
          genre: { $in: newArr },
        },
      },
    ]);

    if (!Song) {
      return res.status(404).json({ message: "No Song found on user genre" });
    }
    return res.status(200).json({
      message: "successfully gotten a Song",
      data: Song[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching Song", error: error.message });
  }
};

const createRelease = async (req, res) => {
  try {
    const {
      title,
      release_date,
      cover_image,
      genre,
      label,
      type,
      songs,
      artistId,
    } = req.body;
    const parseSongs = JSON.parse(JSON.stringify(songs));

    if (type == "single" && parseSongs.length != 1) {
      return res
        .status(401)
        .json({ message: "A single can only contain one song" });
    }

    const release = new Release({
      title,
      release_date,
      cover_image,
      genre,
      label,
      type,
      artistId,
    });

    const songsToSave = [];
    const tracksToSave = [];

    for (let i = 0; i < parseSongs.length; i++) {
      const element = parseSongs[i];
      const song = new Song({
        fileUrl: element.song,
      });
      songsToSave.push(song);

      const track = new Track({
        releaseId: release._id,
        title: element.title,
        duration: element.duration,
        track_number: i + 1,
        artistId,
        songId: song._id,
        genre,
      });
      tracksToSave.push(track);
    }

    await Song.insertMany(songsToSave);
    await Track.insertMany(tracksToSave);
    await release.save();

    return res.status(200).json({
      message: "successfully created a Song",
      data: release,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating Song", error: error.message });
  }
};

const addRelease = async (req, res) => {
  try {
    const { title, artistId, releaseId, file, duration } = req.body;

    const release = await Release.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: releaseId,
              },
            ],
          },
        },
      },
      ...releaseObject,
    ]);

    console.log(release);

    if (!release) {
      return res.status(401).json({ message: "Release not found" });
    }

    if (release[0].type == "single" && release[0].tracklists.length == 1) {
      return res
        .status(401)
        .json({ message: "A single can only contain one song" });
    }

    if (release[0].type == "album" && release[0].tracklists.length == 15) {
      return res
        .status(401)
        .json({ message: "An album can only contain 10 - 15 songs" });
    }

    if (release[0].type == "ep" && release[0].tracklists.length == 10) {
      return res
        .status(401)
        .json({ message: "An EP can only contain 10 songs" });
    }

    const currentTrack = await Track.find({ releaseId: releaseId });

    const song = new Song({
      fileUrl: file,
    });

    const track = new Track({
      releaseId: releaseId,
      title: title,
      duration: duration,
      track_number: currentTrack.length + 1,
      artistId,
      songId: song._id,
    });

    await Promise.all([song.save(), track.save()]);

    return res.status(200).json({
      message: "successfully created a Song",
      data: track,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating Song", error: error.message });
  }
};

const deleteASongFromARelease = async (req, res) => {
  try {
    const { songId, trackId } = req.params;

    const track = await Track.findById(trackId);

    if (!track) {
      return res.status(401).json({ message: "Release not found" });
    }

    await Promise.all([
      Song.findByIdAndDelete({
        _id: songId,
      }),
      Track.findByIdAndDelete({ _id: trackId }),
    ]);

    return res.status(200).json({
      message: "successfully deleted a Song",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error deleting Song", error: error.message });
  }
};

const streamSong = async (req, res) => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

const getTop100Songs = async () => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

const getTopSongsForArtist = async () => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

const getAlbumsAndEpByArtist = async () => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

const getSingles = async () => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

const geSongArtistFeaturedOn = async () => {
  try {
    const { songId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
  }
};

module.exports = {
  getAllSongs,
  getSong,
  createRelease,
  addRelease,
  deleteASongFromARelease,
  getAllReleases,
  getRelease,
  getReleaseBasedOnGenres,
  streamSong,
};
