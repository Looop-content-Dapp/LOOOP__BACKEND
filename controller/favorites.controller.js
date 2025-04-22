import { Favorites } from "../models/favorites.model.js";
import { Track } from "../models/track.model.js";
import { Release } from "../models/releases.model.js";
import mongoose from "mongoose";

// Get user's favorite tracks with detailed information
export const getFavoriteTracks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const favorites = await Favorites.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$tracks" },
      { $sort: { "tracks.addedAt": -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "tracks",
          localField: "tracks.trackId",
          foreignField: "_id",
          as: "trackDetails"
        }
      },
      { $unwind: "$trackDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "trackDetails.artistId",
          foreignField: "_id",
          as: "artistDetails"
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackDetails.releaseId",
          foreignField: "_id",
          as: "releaseDetails"
        }
      },
      {
        $project: {
          _id: "$tracks._id",
          addedAt: "$tracks.addedAt",
          track: {
            _id: "$trackDetails._id",
            title: "$trackDetails.title",
            duration: "$trackDetails.duration",
            artist: { $arrayElemAt: ["$artistDetails", 0] },
            release: { $arrayElemAt: ["$releaseDetails", 0] }
          }
        }
      }
    ]);

    const total = await Favorites.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $project: { count: { $size: "$tracks" } } }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved favorite tracks",
      data: {
        tracks: favorites,
        total: total[0]?.count || 0,
        hasMore: total[0]?.count > (skip + favorites.length)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching favorite tracks",
      error: error.message
    });
  }
};

// Get user's favorite releases with detailed information
export const getFavoriteReleases = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (type) {
      matchStage["releases.type"] = type;
    }

    const favorites = await Favorites.aggregate([
      { $match: matchStage },
      { $unwind: "$releases" },
      { $sort: { "releases.addedAt": -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "releases",
          localField: "releases.releaseId",
          foreignField: "_id",
          as: "releaseDetails"
        }
      },
      { $unwind: "$releaseDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "releaseDetails.artistId",
          foreignField: "_id",
          as: "artistDetails"
        }
      },
      {
        $project: {
          _id: "$releases._id",
          addedAt: "$releases.addedAt",
          type: "$releases.type",
          release: {
            _id: "$releaseDetails._id",
            title: "$releaseDetails.title",
            artwork: "$releaseDetails.artwork",
            artist: { $arrayElemAt: ["$artistDetails", 0] },
            releaseDate: "$releaseDetails.dates.release_date"
          }
        }
      }
    ]);

    const total = await Favorites.aggregate([
      { $match: matchStage },
      { $project: { count: { $size: "$releases" } } }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved favorite releases",
      data: {
        releases: favorites,
        total: total[0]?.count || 0,
        hasMore: total[0]?.count > (skip + favorites.length)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching favorite releases",
      error: error.message
    });
  }
};

// Remove track from favorites
export const removeTrackFromFavorites = async (req, res) => {
  try {
    const { userId, trackId } = req.params;

    const result = await Favorites.findOneAndUpdate(
      { userId },
      { $pull: { tracks: { trackId } } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        message: "Favorites not found"
      });
    }

    return res.status(200).json({
      message: "Track removed from favorites successfully",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error removing track from favorites",
      error: error.message
    });
  }
};

// Remove release from favorites
export const removeReleaseFromFavorites = async (req, res) => {
  try {
    const { userId, releaseId } = req.params;

    const result = await Favorites.findOneAndUpdate(
      { userId },
      { $pull: { releases: { releaseId } } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        message: "Favorites not found"
      });
    }

    return res.status(200).json({
      message: "Release removed from favorites successfully",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error removing release from favorites",
      error: error.message
    });
  }
};

// Add item to favorites (handles both tracks and releases)
export const addToFavorites = async (req, res) => {
  try {
    const { userId, itemId, itemType } = req.body;

    if (!userId || !itemId || !itemType) {
      return res.status(400).json({
        message: "userId, itemId, and itemType are required",
        required: ["userId", "itemId", "itemType (track or release)"]
      });
    }

    if (!['track', 'release'].includes(itemType)) {
      return res.status(400).json({
        message: "Invalid itemType. Must be either 'track' or 'release'"
      });
    }

    // Verify item exists
    let item;
    if (itemType === 'track') {
      item = await Track.findById(itemId);
    } else {
      item = await Release.findById(itemId);
    }

    if (!item) {
      return res.status(404).json({
        message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} not found`
      });
    }

    // Prepare update operation based on item type
    const updateOperation = {
      $addToSet: {
        [itemType === 'track' ? 'tracks' : 'releases']: {
          [`${itemType}Id`]: itemId,
          ...(itemType === 'release' && { type: item.type }),
          addedAt: new Date()
        }
      }
    };

    // Add to favorites using findOneAndUpdate
    const result = await Favorites.findOneAndUpdate(
      { userId },
      updateOperation,
      {
        new: true,
        upsert: true
      }
    );

    return res.status(200).json({
      message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} added to favorites successfully`,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding item to favorites",
      error: error.message
    });
  }
};

// Get user's favorite items (both tracks and releases)
export const getFavoriteItems = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get tracks
    const tracks = await Favorites.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$tracks" },
      { $sort: { "tracks.addedAt": -1 } },
      {
        $lookup: {
          from: "tracks",
          localField: "tracks.trackId",
          foreignField: "_id",
          as: "trackDetails"
        }
      },
      { $unwind: "$trackDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "trackDetails.artistId",
          foreignField: "_id",
          as: "artistDetails"
        }
      },
      {
        $lookup: {
          from: "releases",
          localField: "trackDetails.releaseId",
          foreignField: "_id",
          as: "releaseDetails"
        }
      },
      {
        $project: {
          _id: "$tracks._id",
          addedAt: "$tracks.addedAt",
          itemType: "track",
          item: {
            _id: "$trackDetails._id",
            title: "$trackDetails.title",
            duration: "$trackDetails.duration",
            artist: { $arrayElemAt: ["$artistDetails", 0] },
            release: { $arrayElemAt: ["$releaseDetails", 0] }
          }
        }
      }
    ]);

    // Get releases
    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (type) {
      matchStage["releases.type"] = type;
    }

    const releases = await Favorites.aggregate([
      { $match: matchStage },
      { $unwind: "$releases" },
      { $sort: { "releases.addedAt": -1 } },
      {
        $lookup: {
          from: "releases",
          localField: "releases.releaseId",
          foreignField: "_id",
          as: "releaseDetails"
        }
      },
      { $unwind: "$releaseDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "releaseDetails.artistId",
          foreignField: "_id",
          as: "artistDetails"
        }
      },
      {
        $project: {
          _id: "$releases._id",
          addedAt: "$releases.addedAt",
          itemType: "release",
          type: "$releases.type",
          item: {
            _id: "$releaseDetails._id",
            title: "$releaseDetails.title",
            artwork: "$releaseDetails.artwork",
            artist: { $arrayElemAt: ["$artistDetails", 0] },
            releaseDate: "$releaseDetails.dates.release_date"
          }
        }
      }
    ]);

    // Combine and sort by addedAt
    const allItems = [...tracks, ...releases]
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(skip, skip + parseInt(limit));

    // Get total counts
    const [trackCount, releaseCount] = await Promise.all([
      Favorites.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $project: { count: { $size: "$tracks" } } }
      ]),
      Favorites.aggregate([
        { $match: matchStage },
        { $project: { count: { $size: "$releases" } } }
      ])
    ]);

    const totalCount = (trackCount[0]?.count || 0) + (releaseCount[0]?.count || 0);

    return res.status(200).json({
      message: "Successfully retrieved favorite items",
      data: {
        items: allItems,
        counts: {
          total: totalCount,
          tracks: trackCount[0]?.count || 0,
          releases: releaseCount[0]?.count || 0
        },
        hasMore: totalCount > (skip + allItems.length)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching favorite items",
      error: error.message
    });
  }
};
