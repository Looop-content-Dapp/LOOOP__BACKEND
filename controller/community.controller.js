const mongoose = require("mongoose");
const Artist = require("../models/artist.model");
const Community = require("../models/community.model");
const CommunityMember = require("../models/communitymembers.mode");
const Preferences = require("../models/Preferences");

const getAllCommunity = async (req, res) => {
  try {
    const communities = await Community.find({});

    return res.status(200).json({
      message: "successfully get all communities",
      data: communities,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching communities", error: error.message });
  }
};

const getCommunity = async (req, res) => {
  try {
    const community = await Community.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.communityid,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "communitymembers",
          localField: "_id",
          foreignField: "communityId",
          as: "members",
        },
      },
    ]);

    if (!community) {
      return res.status(404).json({ message: "community not found" });
    }

    return res.status(200).json({
      message: "successfully gotten a community",
      data: community[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching community", error: error.message });
  }
};

const createCommunity = async (req, res) => {
  try {
    const {
      name,
      description,
      coverImage,
      collectibleName,
      collectibleDescription,
      collectibleImage,
      collectibleType,
      artistId
    } = req.body;

    if (!name || !description || !coverImage || !collectibleName || !collectibleImage || !artistId) {
      return res.status(400).json({
        message: "Missing required fields",
        required: [
          'name',
          'description',
          'coverImage',
          'collectibleName',
          'collectibleImage',
          'artistId'
        ]
      });
    }

    if (collectibleImage) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (collectibleImage.size > maxSize) {
        return res.status(400).json({
          message: "Collectible image must be less than 50MB"
        });
      }
    }

    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    const community = new Community({
      name,
      description,
      coverImage,
      tribePass: {
        collectibleName,
        collectibleDescription,
        collectibleImage,
        collectibleType
      },
      createdBy: artistId
    });

    await community.save();
    await community.populate('createdBy', 'name email profileImage genre verified');

    return res.status(201).json({
      message: "Successfully created tribe",
      data: community
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error creating tribe",
      error: error.message
    });
  }
};

const deleteCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { artistId } = req.body;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        message: "Community not found"
      });
    }

    if (community.createdBy.toString() !== artistId) {
      return res.status(403).json({
        message: "Only the community creator can delete the community"
      });
    }

    await CommunityMember.deleteMany({ communityId: communityId });
    await Community.findByIdAndDelete(communityId);

    return res.status(200).json({
      message: "Community successfully deleted",
      data: {
        communityId,
        name: community.name
      }
    });
  } catch (error) {
    console.error("Error in deleteCommunity:", error);
    return res.status(500).json({
      message: "Error deleting community",
      error: error.message
    });
  }
};

const joinCommunity = async (req, res) => {
  try {
    const { userId, communityId } = req.body;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(400).json({ message: "community doesn't exist" });
    }

    const userAlreadyExistinCommunity = await CommunityMember.aggregate([
      {
        $match: {
          $and: [
            {
              $expr: {
                $eq: [
                  {
                    $toObjectId: userId,
                  },
                  "$userId",
                ],
              },
            },
            {
              $expr: {
                $eq: [
                  {
                    $toObjectId: communityId,
                  },
                  "$communityId",
                ],
              },
            },
          ],
        },
      },
    ]);

    if (userAlreadyExistinCommunity.length > 0) {
      return res.status(400).json({ message: "User already exist in community" });
    }

    const communitymember = new CommunityMember({
      userId,
      communityId,
    });

    await communitymember.save();

    return res.status(200).json({
      message: "successfully joined a community",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error joining community", error: error.message });
  }
};

const searchCommunity = async (req, res) => {
  try {
    const { query } = req.query;

    const results = await Community.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: 1 });

    return res.status(200).json({
      message: "success",
      searchResults: results,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return res
      .status(500)
      .json({ message: "Error searching", error: error.message });
  }
};

const getArtistCommunitiesByGenre = async (req, res) => {
    try {
      const { userId } = req.params;

      // First get user's genre preferences
      const userPreferences = await Preferences.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $lookup: {
            from: "genres",
            localField: "genreId",
            foreignField: "_id",
            as: "genre"
          }
        },
        {
          $unwind: "$genre"
        }
      ]);

      if (!userPreferences || userPreferences.length === 0) {
        return res.status(404).json({
          message: "No preferences found for this user"
        });
      }

      // Get genre names from preferences since artist.genre is stored as string
      const genreNames = userPreferences.map(pref => pref.genre.name);

      // Find artists matching these genres
      const artists = await Artist.aggregate([
        {
          $match: {
            genre: { $in: genreNames } // Match by genre name instead of ID
          }
        },
        {
          $lookup: {
            from: "communities",
            let: { artistId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$createdBy", "$$artistId"] }
                }
              },
              {
                $lookup: {
                  from: "communitymembers",
                  localField: "_id",
                  foreignField: "communityId",
                  as: "members"
                }
              },
              {
                $addFields: {
                  memberCount: { $size: "$members" }
                }
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  description: 1,
                  coverImage: 1,
                  tribePass: 1,
                  memberCount: 1,
                  createdAt: 1,
                  status: 1
                }
              }
            ],
            as: "communities"
          }
        },
        // Remove the filter for artists with communities to show all artists
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            profileImage: 1,
            genre: 1,
            verified: 1,
            bio: 1,
            communities: {
              $filter: {
                input: "$communities",
                as: "community",
                cond: { $eq: ["$$community.status", "active"] }
              }
            },
            communityCount: {
              $size: {
                $filter: {
                  input: "$communities",
                  as: "community",
                  cond: { $eq: ["$$community.status", "active"] }
                }
              }
            }
          }
        },
        {
          $sort: { communityCount: -1, name: 1 }
        }
      ]);

      // If no artists found, return empty array but with success status
      if (!artists || artists.length === 0) {
        return res.status(200).json({
          message: "No artists found for these genres",
          data: {
            preferences: userPreferences.map(pref => ({
              genreId: pref.genreId,
              genreName: pref.genre.name
            })),
            artists: []
          }
        });
      }

      return res.status(200).json({
        message: "Successfully retrieved artists and their communities by genre",
        data: {
          preferences: userPreferences.map(pref => ({
            genreId: pref.genreId,
            genreName: pref.genre.name
          })),
          artists: artists
        }
      });
    } catch (error) {
      console.error("Error in getArtistCommunitiesByGenre:", error);
      return res.status(500).json({
        message: "Error fetching artists and their communities",
        error: error.message
      });
    }
  };

const getTrendingArtistsByGenre = async (req, res) => {
  try {
    const { userId } = req.params;
    const timeframe = req.query.timeframe || '7d';

    const getDateThreshold = () => {
      const now = new Date();
      switch (timeframe) {
        case '24h':
          return new Date(now.setDate(now.getDate() - 1));
        case '7d':
          return new Date(now.setDate(now.getDate() - 7));
        case '30d':
          return new Date(now.setDate(now.getDate() - 30));
        default:
          return new Date(now.setDate(now.getDate() - 7));
      }
    };

    const dateThreshold = getDateThreshold();
    const userPreferences = await Preferences.find({ userId });
    const genreIds = userPreferences.map(pref => pref.genreId);

    const trendingArtists = await Artist.aggregate([
      {
        $match: {
          genre: { $in: genreIds }
        }
      },
      {
        $lookup: {
          from: "communities",
          let: { artistId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$createdBy", "$$artistId"] }
              }
            },
            {
              $lookup: {
                from: "communitymembers",
                localField: "_id",
                foreignField: "communityId",
                as: "members"
              }
            },
            {
              $addFields: {
                memberCount: { $size: "$members" },
                recentMembers: {
                  $size: {
                    $filter: {
                      input: "$members",
                      as: "member",
                      cond: { $gte: ["$$member.createdAt", dateThreshold] }
                    }
                  }
                }
              }
            },
            {
              $project: {
                name: 1,
                description: 1,
                coverImage: 1,
                tribePass: 1,
                memberCount: 1,
                recentMembers: 1,
                createdAt: 1
              }
            }
          ],
          as: "communities"
        }
      },
      {
        $match: {
          "communities.0": { $exists: true }
        }
      },
      {
        $addFields: {
          totalMembers: {
            $reduce: {
              input: "$communities",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.memberCount"] }
            }
          },
          totalRecentMembers: {
            $reduce: {
              input: "$communities",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.recentMembers"] }
            }
          }
        }
      },
      {
        $addFields: {
          trendingScore: {
            $add: [
              "$totalMembers",
              { $multiply: ["$totalRecentMembers", 2] }
            ]
          }
        }
      },
      {
        $sort: { trendingScore: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          profileImage: 1,
          genre: 1,
          verified: 1,
          communities: 1,
          totalMembers: 1,
          totalRecentMembers: 1,
          trendingScore: 1
        }
      }
    ]);

    return res.status(200).json({
      message: "Successfully retrieved trending artists and their communities",
      data: {
        timeframe,
        artists: trendingArtists
      }
    });
  } catch (error) {
    console.error("Error in getTrendingArtistsByGenre:", error);
    return res.status(500).json({
      message: "Error fetching trending artists",
      error: error.message
    });
  }
};

module.exports = {
  getAllCommunity,
  getCommunity,
  createCommunity,
  joinCommunity,
  searchCommunity,
  deleteCommunity,
  getArtistCommunitiesByGenre,
  getTrendingArtistsByGenre
};
