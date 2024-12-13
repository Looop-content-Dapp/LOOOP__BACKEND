import { Track } from "../models/track.model";
// import { Song } from "../models/song.model";
import { Artist } from "../models/artist.model";
import { Release } from "../models/releases.model";
import { PlayListName } from "../models/playlistnames.model";
// import { PlayListSongs } from "../models/playlistsongs.model";
import { RecentSearch } from "../models/recentSearch.model";

export const searchAll = async (req, res) => {
  try {
    const {
      query,
      page = 1,
      limit = 20,
      sort = 'relevance'
    } = req.query;
    const userId = req.user?._id;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    // Store search if user is authenticated
    if (userId) {
      await storeRecentSearch(userId, query);
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
                $limit: 5
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

    // Get total counts
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

export const storeRecentSearch = async (userId, query) => {
  try {
    await RecentSearch.create({
      userId,
      query,
      timestamp: new Date()
    });

    // Keep only last 10 searches
    const searches = await RecentSearch.find({ userId })
      .sort({ timestamp: -1 });

    if (searches.length > 10) {
      const searchesToDelete = searches.slice(10);
      await RecentSearch.deleteMany({
        _id: { $in: searchesToDelete.map(s => s._id) }
      });
    }
  } catch (error) {
    console.error("Error storing recent search:", error);
  }
};

export const getRecentSearches = async (req, res) => {
  try {
    const userId = req.user?._id;

    const searches = await RecentSearch.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('query timestamp -_id');

    return res.status(200).json({
      success: true,
      data: searches
    });
  } catch (error) {
    console.error("Error fetching recent searches:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching recent searches",
      error: error.message
    });
  }
};

export const clearRecentSearches = async (req, res) => {
  try {
    const userId = req.user?._id;

    await RecentSearch.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "Recent searches cleared successfully"
    });
  } catch (error) {
    console.error("Error clearing recent searches:", error);
    return res.status(500).json({
      success: false,
      message: "Error clearing recent searches",
      error: error.message
    });
  }
};

export const getTrendingSearches = async (req, res) => {
  try {
    const { timeframe = '24h', limit = 10 } = req.query;

    const timeFilter = {
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    }[timeframe] || 24;

    const timestamp = new Date();
    timestamp.setHours(timestamp.getHours() - timeFilter);

    const trending = await RecentSearch.aggregate([
      {
        $match: {
          timestamp: { $gte: timestamp }
        }
      },
      {
        $group: {
          _id: '$query',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    return res.status(200).json({
      success: true,
      data: trending.map(t => ({
        query: t._id,
        searchCount: t.count
      }))
    });
  } catch (error) {
    console.error("Error fetching trending searches:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching trending searches",
      error: error.message
    });
  }
};

export const searchByCategory = async (req, res) => {
  try {
    const {
      query,
      category,
      page = 1,
      limit = 20,
      sort = 'relevance'
    } = req.query;

    if (!query || !category) {
      return res.status(400).json({
        success: false,
        message: "Both query and category are required"
      });
    }

    const validatedPage = Math.max(1, parseInt(page) || 1);
    const validatedLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (validatedPage - 1) * validatedLimit;
    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    let results, total;
    const categoryMap = {
      tracks: Track,
      artists: Artist,
      releases: Release,
      playlists: PlayListName
    };

    const Model = categoryMap[category.toLowerCase()];
    if (!Model) {
      return res.status(400).json({
        success: false,
        message: "Invalid category"
      });
    }

    // Use the existing aggregate pipelines based on category
    switch (category.toLowerCase()) {
      case 'tracks':
        [results, total] = await Promise.all([
          Track.aggregate([
            {
              $match: { title: searchRegex }
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
              $lookup: {
                from: "artists",
                localField: "artistId",
                foreignField: "_id",
                as: "artist"
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
            { $skip: skip },
            { $limit: validatedLimit }
          ]),
          Track.countDocuments({ title: searchRegex })
        ]);
        break;

      case 'artists':
        [results, total] = await Promise.all([
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
            { $skip: skip },
            { $limit: validatedLimit }
          ]),
          Artist.countDocuments({
            $or: [
              { name: searchRegex },
              { genre: searchRegex }
            ]
          })
        ]);
        break;

      case 'releases':
        [results, total] = await Promise.all([
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
            { $skip: skip },
            { $limit: validatedLimit }
          ]),
          Release.countDocuments({
            $or: [
              { title: searchRegex },
              { "metadata.genre": searchRegex }
            ]
          })
        ]);
        break;

      case 'playlists':
        [results, total] = await Promise.all([
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
            { $skip: skip },
            { $limit: validatedLimit }
          ]),
          PlayListName.countDocuments({
            $or: [
              { title: searchRegex },
              { description: searchRegex }
            ]
          })
        ]);
        break;
    }

    return res.status(200).json({
      success: true,
      data: {
        items: results,
        total,
        hasMore: total > (skip + results.length)
      },
      metadata: {
        query,
        category,
        pagination: {
          current: validatedPage,
          limit: validatedLimit,
          totalResults: total
        }
      }
    });

  } catch (error) {
    console.error("Category search error:", error);
    return res.status(500).json({
      success: false,
      message: "Error performing category search",
      error: error.message
    });
  }
};

// export default {
//   searchAll,
//   getRecentSearches,
//   clearRecentSearches,
//   getTrendingSearches,
//   searchByCategory
// };
