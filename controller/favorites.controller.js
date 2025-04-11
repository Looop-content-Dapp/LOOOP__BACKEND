import { Favorites } from "../models/favorites.model.js";

// Add track to favorites
export const addTrackToFavorites = async (req, res) => {
  try {
    const { userId, trackId } = req.body;

    if (!userId || !trackId) {
      return res.status(400).json({
        message: "userId and trackId are required"
      });
    }

    let userFavorites = await Favorites.findOne({ userId });

    if (!userFavorites) {
      userFavorites = new Favorites({ userId, tracks: [] });
    }

    // Check if track already exists in favorites
    const trackExists = userFavorites.tracks.some(
      track => track.trackId.toString() === trackId
    );

    if (trackExists) {
      return res.status(400).json({
        message: "Track already in favorites"
      });
    }

    userFavorites.tracks.push({
      trackId,
      addedAt: new Date()
    });

    await userFavorites.save();

    return res.status(200).json({
      message: "Track added to favorites successfully",
      data: userFavorites
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding track to favorites",
      error: error.message
    });
  }
};

// Add release to favorites
export const addReleaseToFavorites = async (req, res) => {
  try {
    const { userId, releaseId } = req.body;

    if (!userId || !releaseId) {
      return res.status(400).json({
        message: "userId and releaseId are required"
      });
    }

    let userFavorites = await Favorites.findOne({ userId });

    if (!userFavorites) {
      userFavorites = new Favorites({ userId, releases: [] });
    }

    // Check if release already exists in favorites
    const releaseExists = userFavorites.releases.some(
      release => release.releaseId.toString() === releaseId
    );

    if (releaseExists) {
      return res.status(400).json({
        message: "Release already in favorites"
      });
    }

    userFavorites.releases.push({
      releaseId,
      addedAt: new Date()
    });

    await userFavorites.save();

    return res.status(200).json({
      message: "Release added to favorites successfully",
      data: userFavorites
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding release to favorites",
      error: error.message
    });
  }
};

// Get user's favorite tracks
export const getFavoriteTracks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const favorites = await Favorites.findOne({ userId })
      .populate({
        path: 'tracks.trackId',
        populate: [
          {
            path: 'artistId',
            model: 'artist', // Changed from 'artists' to 'artist'
            select: 'name profileImage'
          },
          {
            path: 'releaseId',
            model: 'releases',
            select: 'title artwork'
          }
        ]
      })
      .lean();

    if (!favorites) {
      return res.status(200).json({
        message: "No favorites found",
        data: { tracks: [] }
      });
    }

    const tracks = favorites.tracks
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      message: "Successfully retrieved favorite tracks",
      data: {
        tracks,
        total: favorites.tracks.length,
        hasMore: favorites.tracks.length > (skip + tracks.length)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching favorite tracks",
      error: error.message
    });
  }
};

// Get user's favorite releases
export const getFavoriteReleases = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const favorites = await Favorites.findOne({ userId })
      .populate({
        path: 'releases.releaseId',
        populate: {
          path: 'artistId',
          model: 'artist', // Changed from 'artists' to 'artist'
          select: 'name profileImage'
        }
      })
      .lean();

    if (!favorites) {
      return res.status(200).json({
        message: "No favorites found",
        data: { releases: [] }
      });
    }

    const releases = favorites.releases
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      message: "Successfully retrieved favorite releases",
      data: {
        releases,
        total: favorites.releases.length,
        hasMore: favorites.releases.length > (skip + releases.length)
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
