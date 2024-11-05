// controllers/search.controller.js

const Track = require("../models/track.model");
const Song = require("../models/song.model");
const Artist = require("../models/artist.model");
const Release = require("../models/releases.model");
const PlayListName = require("../models/playlistnames.model");
const PlayListSongs = require("../models/playlistsongs.model");

const searchAll = async (req, res) => {
    try {
      const {
        query,
        page = 1,
        limit = 20,
        sort = 'relevance'
      } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Search query is required"
        });
      }

      const validatedPage = Math.max(1, parseInt(page) || 1);
      const validatedLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const skip = (validatedPage - 1) * validatedLimit;
      const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const [tracks, artists, releases, playlists] = await Promise.all([
        // Track Search with Song info
        Track.aggregate([
          {
            $match: {
              title: searchRegex
            }
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
            $unwind: {
              path: "$release",
              preserveNullAndEmptyArrays: true
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
            $unwind: {
              path: "$artist",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: "songs",
              localField: "songId",
              foreignField: "_id",
              as: "song"
            }
          },
          {
            $unwind: {
              path: "$song",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              duration: 1,
              track_number: 1,
              artist: {
                _id: "$artist._id",
                name: "$artist.name",
                image: "$artist.profileImage"
              },
              release: {
                _id: "$release._id",
                title: "$release.title",
                artwork: "$release.artwork.cover_image",
                releaseDate: "$release.dates.release_date",
                type: "$release.type"
              },
              song: {
                _id: "$song._id",
                fileUrl: "$song.fileUrl",
                analytics: {
                  totalStreams: { $ifNull: ["$song.analytics.totalStreams", 0] },
                  likes: { $ifNull: ["$song.analytics.likes", 0] }
                },
                flags: "$song.flags"
              }
            }
          },
          {
            $sort: sort === 'recent'
              ? { "release.releaseDate": -1 }
              : sort === 'popular'
                ? { "song.analytics.totalStreams": -1 }
                : { title: 1 }
          },
          { $skip: skip },
          { $limit: validatedLimit }
        ]),

        // Artist Search
        Artist.aggregate([
          {
            $match: {
              $or: [
                { name: searchRegex },
                { genre: searchRegex }
              ]
            }
          },
          {
            $lookup: {
              from: "releases",
              localField: "_id",
              foreignField: "artistId",
              as: "releases"
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              profileImage: 1,
              bio: 1,
              genre: 1,
              verified: 1,
              totalReleases: { $size: "$releases" }
            }
          },
          { $skip: skip },
          { $limit: validatedLimit }
        ]),

        // Release Search
        Release.aggregate([
          {
            $match: {
              $or: [
                { title: searchRegex },
                { "metadata.genre": searchRegex }
              ]
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
            $unwind: {
              path: "$artist",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              type: 1,
              artwork: "$artwork.cover_image",
              dates: {
                release_date: "$dates.release_date",
                announcement_date: "$dates.announcement_date"
              },
              artist: {
                _id: "$artist._id",
                name: "$artist.name",
                image: "$artist.profileImage"
              },
              metadata: {
                genre: 1,
                totalTracks: 1
              }
            }
          },
          { $skip: skip },
          { $limit: validatedLimit }
        ]),

        // Playlist Search
        PlayListName.aggregate([
          {
            $match: {
              $or: [
                { title: searchRegex },
                { description: searchRegex }
              ]
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
              let: { songIds: "$songs.trackId" },
              pipeline: [
                {
                  $match: {
                    $expr: { $in: ["$_id", "$$songIds"] }
                  }
                },
                {
                  $limit: 5 // Preview tracks
                }
              ],
              as: "previewTracks"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "creator"
            }
          },
          {
            $unwind: {
              path: "$creator",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              coverImage: 1,
              isPublic: 1,
              isPinned: 1,
              followerCount: 1,
              totalDuration: 1,
              totalTracks: 1,
              createdDate: 1,
              lastModified: 1,
              creator: {
                _id: "$creator._id",
                name: "$creator.name"
              },
              previewTracks: {
                $map: {
                  input: "$previewTracks",
                  as: "track",
                  in: {
                    _id: "$$track._id",
                    title: "$$track.title"
                  }
                }
              },
              dominantGenre: 1,
              genreDistribution: 1
            }
          },
          {
            $sort: sort === 'recent'
              ? { lastModified: -1 }
              : sort === 'popular'
                ? { followerCount: -1 }
                : { title: 1 }
          },
          { $skip: skip },
          { $limit: validatedLimit }
        ])
      ]);

      // Get total counts for matched items only
      const [tracksCount, artistsCount, releasesCount, playlistsCount] = await Promise.all([
        Track.countDocuments({ title: searchRegex }),
        Artist.countDocuments({
          $or: [
            { name: searchRegex },
            { genre: searchRegex }
          ]
        }),
        Release.countDocuments({
          $or: [
            { title: searchRegex },
            { "metadata.genre": searchRegex }
          ]
        }),
        PlayListName.countDocuments({
          $or: [
            { title: searchRegex },
            { description: searchRegex }
          ]
        })
      ]);

      // Format response
      const response = {
        success: true,
        message: "Search completed successfully",
        data: {
          tracks: {
            items: tracks,
            total: tracksCount,
            hasMore: tracksCount > (skip + tracks.length)
          },
          artists: {
            items: artists,
            total: artistsCount,
            hasMore: artistsCount > (skip + artists.length)
          },
          releases: {
            items: releases,
            total: releasesCount,
            hasMore: releasesCount > (skip + releases.length)
          },
          playlists: {
            items: playlists,
            total: playlistsCount,
            hasMore: playlistsCount > (skip + playlists.length)
          }
        },
        metadata: {
          query,
          pagination: {
            current: validatedPage,
            limit: validatedLimit,
            totalResults: tracksCount + artistsCount + releasesCount + playlistsCount
          }
        }
      };

      return res.status(200).json(response);

    } catch (error) {
      console.error("Search error:", error);
      return res.status(500).json({
        success: false,
        message: "Error performing search",
        error: error.message
      });
    }
  };

  module.exports = {
    searchAll
  };
