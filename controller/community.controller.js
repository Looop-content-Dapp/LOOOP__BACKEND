import { Types } from "mongoose";
import { Artist } from "../models/artist.model.js";
import { Community } from "../models/community.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import { Preferences } from "../models/preferences.model.js";

export const getAllCommunity = async (req, res) => {
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

export const getCommunity = async (req, res) => {
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

export const createCommunity = async (req, res) => {
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

export const deleteCommunity = async (req, res) => {
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

export const joinCommunity = async (req, res) => {
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

export const searchCommunity = async (req, res) => {
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

export const getArtistCommunitiesByGenre = async (req, res) => {
  try {
    const { userId } = req.params;

    // First get user's genre preferences with genre details
    const userPreferences = await Preferences.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId)
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

    // Get genre names since Artist.genre is stored as string
    const genreNames = userPreferences.map(pref => pref.genre.name);

    // Create regex patterns for each genre name
    const genrePatterns = genreNames.map(name => new RegExp(name.trim(), 'i'));

    // Create a mapping of genre names to complete genre info
    const genreMap = userPreferences.reduce((acc, pref) => {
      acc[pref.genre.name] = {
        id: pref.genreId,
        name: pref.genre.name,
        image: pref.genre.image,
        description: pref.genre.description
      };
      return acc;
    }, {});

    // Create a response object to group communities by genre
    const genreBasedResults = {};
    genreNames.forEach(genreName => {
      genreBasedResults[genreName] = [];
    });

    // Find artists and their communities for each genre
    const artists = await Artist.aggregate([
      {
        $match: {
          $or: genrePatterns.map(pattern => ({
            genre: pattern
          }))
        }
      },
      {
        $addFields: {
          // Split the genre string into an array
          genreArray: {
            $split: ["$genre", ","]
          }
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
              $match: {
                status: "active"
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
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          profileImage: 1,
          genre: 1,
          genreArray: 1,
          verified: 1,
          bio: 1,
          communities: 1,
          communityCount: { $size: "$communities" }
        }
      },
      {
        $sort: { communityCount: -1, name: 1 }
      }
    ]);

    // Organize artists by genre, handling multiple genres per artist
    artists.forEach(artist => {
      if (artist.communities.length > 0) {
        // Get array of trimmed genres
        const artistGenres = artist.genre.split(',').map(g => g.trim());

        // Add artist to each matching genre category
        artistGenres.forEach(artistGenre => {
          genreNames.forEach(preferenceName => {
            if (artistGenre.toLowerCase() === preferenceName.toLowerCase() &&
              genreBasedResults[preferenceName]) {
              genreBasedResults[preferenceName].push({
                ...artist,
                communities: artist.communities
              });
            }
          });
        });
      }
    });

    // Format the response with complete genre information
    const formattedResponse = Object.entries(genreBasedResults).map(([genreName, artists]) => ({
      ...genreMap[genreName],
      artists: Array.from(new Set(artists.map(a => a._id))).map(id =>
        artists.find(a => a._id.toString() === id.toString())
      ) // Remove duplicate artists within each genre
    }));

    return res.status(200).json({
      message: "Successfully retrieved artists and their communities by genre",
      data: {
        preferences: userPreferences.map(pref => ({
          genreId: pref.genreId,
          genreName: pref.genre.name,
          genreImage: pref.genre.image,
          genreDescription: pref.genre.description
        })),
        genreBasedCommunities: formattedResponse
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

export const getTrendingArtistsByGenre = async (req, res) => {
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

    // Get user preferences with complete genre information
    const userPreferences = await Preferences.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId)
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

    // Get genre names and create regex patterns
    const genreNames = userPreferences.map(pref => pref.genre.name);
    const genrePatterns = genreNames.map(name => new RegExp(name.trim(), 'i'));

    // Create genre mapping for response
    const genreMap = userPreferences.reduce((acc, pref) => {
      acc[pref.genre.name] = {
        id: pref.genreId,
        name: pref.genre.name,
        image: pref.genre.image,
        description: pref.genre.description
      };
      return acc;
    }, {});

    const trendingArtists = await Artist.aggregate([
      {
        $match: {
          $or: genrePatterns.map(pattern => ({
            genre: pattern
          }))
        }
      },
      {
        $addFields: {
          genreArray: {
            $split: ["$genre", ","]
          }
        }
      },
      {
        $lookup: {
          from: "communities",
          let: { artistId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$createdBy", "$$artistId"] },
                status: "active"
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
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          profileImage: 1,
          genre: 1,
          genreArray: 1,
          verified: 1,
          communities: {
            $map: {
              input: "$communities",
              as: "community",
              in: {
                _id: "$$community._id",
                name: "$$community.name",
                description: "$$community.description",
                coverImage: "$$community.coverImage",
                tribePass: "$$community.tribePass",
                memberCount: "$$community.memberCount",
                recentMembers: "$$community.recentMembers",
                createdAt: "$$community.createdAt"
              }
            }
          },
          totalMembers: 1,
          totalRecentMembers: 1,
          trendingScore: 1
        }
      }
    ]);

    // Organize artists by genre
    const genreBasedResults = {};
    genreNames.forEach(genre => {
      genreBasedResults[genre] = [];
    });

    trendingArtists.forEach(artist => {
      const artistGenres = artist.genre.split(',').map(g => g.trim());

      artistGenres.forEach(artistGenre => {
        genreNames.forEach(preferenceName => {
          if (artistGenre.toLowerCase() === preferenceName.toLowerCase() &&
            genreBasedResults[preferenceName]) {
            genreBasedResults[preferenceName].push(artist);
          }
        });
      });
    });

    // Format response with trending artists for each genre
    const formattedResponse = Object.entries(genreBasedResults).map(([genreName, artists]) => ({
      ...genreMap[genreName],
      artists: Array.from(new Set(artists.map(a => a._id))).map(id =>
        artists.find(a => a._id.toString() === id.toString())
      ).slice(0, 10) // Get top 10 trending artists per genre after deduplication
    }));

    return res.status(200).json({
      message: "Successfully retrieved trending artists and their communities",
      data: {
        timeframe,
        preferences: userPreferences.map(pref => ({
          genreId: pref.genreId,
          genreName: pref.genre.name,
          genreImage: pref.genre.image,
          genreDescription: pref.genre.description
        })),
        trendingByGenre: formattedResponse
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
