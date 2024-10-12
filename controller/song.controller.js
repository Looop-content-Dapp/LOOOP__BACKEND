const Song = require("../models/song.model");
const Release = require("../models/releases.model");
const Track = require("../models/track.model");
const Genre = require("../models/genre.model");
const Preferences = require("../models/Preferences");
const { matchUser } = require("../utils/helpers/searchquery");
const Artist = require("../models/artist.model");
const Follow = require("../models/followers.model");
const LastPlayed = require("../models/lastplayed.model");

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
    $unwind: {
      path: "$tracklists.song",
      preserveNullAndEmptyArrays: true,
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
      {
        $sort: { _id: -1 },
      },
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
        ft: element.ft,
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
    const { title, artistId, releaseId, file, duration, ft } = req.body;

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
      ft,
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

const deleteRlease = async (req, res) => {
  try {
    const { releaseId } = req.params;

    const release = await Release.find({ _id: releaseId });

    if (release.length == 0) {
      return res.status(404).json({ message: "Release not found" });
    }

    const songs = await Track.find({ releaseId: releaseId });

    const songFuncs = [];
    for (let i = 0; i < songs.length; i++) {
      const element = songs[i];
      songFuncs.push(Song.findByIdAndDelete(element.songId));
    }

    await Promise.all([
      ...songFuncs,
      Track.deleteMany({
        releaseId: releaseId,
      }),
      Release.findByIdAndDelete(releaseId),
    ]);

    return res.status(200).json({
      message: "successfully deleted",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error Occured", error: error.message });
  }
};

const streamSong = async (req, res) => {
  try {
    const { songId, userId } = req.params;

    await Song.findByIdAndUpdate(songId, { $inc: { streams: 1 } });

    const track = await Track.findOne({ songId: songId });

    if (!track) {
      return res.status(404).json({ message: "Song not found" });
    }

    const lastPlayedSong = new LastPlayed({
      userId: userId,
      trackId: track._id,
    });

    await lastPlayedSong.save();

    return res.status(200).json({
      message: "successfully streamed a Song",
    });
  } catch (error) {
    console.error("Error updating streams:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getTop100Songs = async (req, res) => {
  try {
    const songs = await Song.aggregate([
      {
        $addFields: {
          rating: {
            $add: ["$streams", "$playlistAdditions", "$shares"],
          },
        },
      },
      {
        $sort: {
          rating: -1,
        },
      },
      {
        $lookup: {
          from: "tracks",
          localField: "_id",
          foreignField: "songId",
          as: "track",
          pipeline: [
            {
              $lookup: {
                from: "releases",
                localField: "releaseId",
                foreignField: "_id",
                as: "release",
              },
            },
            {
              $unwind: {
                path: "$release",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$track",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          coverImage: "$track.release.cover_image",
        },
      },
      {
        $project: {
          track: 0,
        },
      },
      {
        $limit: 100,
      },
    ]);
    return res.status(200).json({
      message: "successfully streamed a Song",
      data: songs,
    });
  } catch (error) {
    console.error("Error occured:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getTopSongsForArtist = async (req, res) => {
  try {
    const { artistId } = req.params;
    const matchUserObj = matchUser({ id: artistId, name: "artistId" });

    const songs = await Track.aggregate([
      {
        $lookup: {
          from: "songs",
          localField: "songId",
          foreignField: "_id",
          as: "song",
        },
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release",
        },
      },
      {
        $unwind: "$release",
      },
      {
        $unwind: {
          path: "$song",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        ...matchUserObj,
      },
      {
        $addFields: {
          rating: {
            $add: ["$song.streams", "$song.playlistAdditions", "$song.shares"],
          },
          coverImage: "$release.cover_image",
        },
      },
      {
        $sort: {
          rating: -1,
        },
      },
      {
        $project: {
          release: 0,
        },
      },
      {
        $limit: 10,
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: songs,
    });
  } catch (error) {
    console.error("an error occured:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getAlbumsAndEpByArtist = async (req, res) => {
  try {
    const { artistId } = req.params;
    const matchUserObj = matchUser({ id: artistId, name: "artistId" });

    const songs = await Track.aggregate([
      {
        ...matchUserObj,
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release",
        },
      },
      {
        $unwind: {
          path: "$release",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          type: "$release.type",
        },
      },
      {
        $match: {
          type: {
            $in: ["album", "ep"],
          },
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: songs,
    });
  } catch (error) {
    console.error("Error updating streams:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getSingles = async (req, res) => {
  try {
    const { artistId } = req.params;
    const matchUserObj = matchUser({ id: artistId, name: "artistId" });

    const songs = await Track.aggregate([
      {
        ...matchUserObj,
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release",
        },
      },
      {
        $unwind: {
          path: "$release",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          type: "$release.type",
        },
      },
      {
        $match: {
          $expr: {
            $eq: ["$type", "single"],
          },
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: songs,
    });
  } catch (error) {
    console.error("Error updating streams:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getSongArtistFeaturedOn = async (req, res) => {
  try {
    const { artistId } = req.params;
    const matchUserObj = matchUser({ id: artistId, name: "artistId" });

    const songs = await Track.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$ft",
              {
                $toObjectId: artistId,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "songs",
          localField: "songId",
          foreignField: "_id",
          as: "song",
        },
      },
      {
        $unwind: {
          path: "$song",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: songs,
    });
  } catch (error) {
    console.error("Error updating streams:", error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const searchSong = async (req, res) => {
  try {
    const { query } = req.query;

    const releases = await Release.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: 1 });

    const artist = await Artist.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: 1 });

    const songs = await Track.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: 1 });

    console.log(query);
    return res.status(200).json({
      message: "success",
      artists: artist,
      songs: songs,
      releases: releases,
    });
  } catch (error) {
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getSongOfArtistTheyFollow = async (req, res) => {
  try {
    const { userId } = req.params;

    const songs = await Follow.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$follower",
              {
                $toObjectId: userId,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "tracks",
          localField: "following",
          foreignField: "artistId",
          as: "tracks",
        },
      },
      {
        $lookup: {
          from: "songs",
          localField: "tracks.songId",
          foreignField: "_id",
          as: "songs",
        },
      },
      {
        $addFields: {
          artistId: "$following",
          tracks: {
            $map: {
              input: "$tracks",
              as: "track",
              in: {
                $mergeObjects: [
                  "$$track",
                  {
                    songDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$songs",
                            as: "song",
                            cond: { $eq: ["$$song._id", "$$track.songId"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          songs: 0,
          _id: 0,
          follower: 0,
          following: 0,
        },
      },
    ]);

    console.log(songs);

    return res.status(200).json({
      message: "success",
      songs: songs,
    });
  } catch (error) {
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getSongLastPlayed = async (req, res) => {
  try {
    const { userId } = req.params;

    const lastplayedSong = await LastPlayed.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$userId",
              {
                $toObjectId: userId,
              },
            ],
          },
        },
      },

      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track",
        },
      },
      {
        $unwind: {
          path: "$track",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "songs",
          localField: "track.songId",
          foreignField: "_id",
          as: "song",
        },
      },
      {
        $unwind: {
          path: "$song",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          "track.songDetails": "$song",
        },
      },
      {
        $project: {
          _id: 0,
          createdAt: 0,
          updatedAt: 0,
          song: 0,
        },
      },
    ]);

    let stringArr = [];
    let objArr = [];
    for (let i = 0; i < lastplayedSong.length; i++) {
      const element = lastplayedSong[i];

      if (!stringArr.includes(JSON.stringify(element))) {
        stringArr.push(JSON.stringify(element));
        objArr.push(element);
      }
    }

    return res.status(200).json({
      message: "success",
      lastplayed: objArr,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getArtistBasedOnUserGenreExcludingWhoTheyFollow = async (req, res) => {
  try {
    const { userId } = req.params;

    const artists = await Artist.aggregate([
      {
        $lookup: {
          from: "follows",
          localField: "follower",
          foreignField: "follower",
          as: "follows",
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: artists,
    });
  } catch (error) {
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const getTracksFromRelease = async (req, res) => {
  try {
    const { releaseId } = req.params;
    console.log("sksksksk");

    const matchObj = matchUser({ name: "releaseId", id: releaseId });

    const tracks = await Track.aggregate([
      { ...matchObj },
      {
        $lookup: {
          from: "songs",
          localField: "songId",
          foreignField: "_id",
          as: "song",
        },
      },
      {
        $unwind: {
          path: "$song",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "releases",
          localField: "releaseId",
          foreignField: "_id",
          as: "release",
        },
      },
      {
        $addFields: {
          coverImage: "$release.cover_image",
        },
      },
      {
        $unwind: {
          path: "$coverImage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          release: 0,
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: tracks,
    });
  } catch (error) {
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
  }
};

const editSongFile = async (req, res) => {
  try {
    const { songId, fileUrl } = req.body;

    const song = await Song.findOneAndUpdate(
      { _id: songId },
      {
        $set: {
          fileUrl: fileUrl,
        },
      }
    );
    if (!song) {
      return res.status(400).json({
        message: "song not found",
      });
    }

    return res.status(200).json({
      message: "success",
    });
  } catch (error) {
    return res.status(500).json({
      message: "an error occurred",
      error: error,
    });
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
  getTop100Songs,
  getTopSongsForArtist,
  getAlbumsAndEpByArtist,
  getSingles,
  getSongArtistFeaturedOn,
  searchSong,
  getSongOfArtistTheyFollow,
  deleteRlease,
  getSongLastPlayed,
  getArtistBasedOnUserGenreExcludingWhoTheyFollow,
  getTracksFromRelease,
  editSongFile,
};
