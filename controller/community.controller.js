import { get, Types } from "mongoose";
import validator from "validator";

import { Artist } from "../models/artist.model.js";
import { Community } from "../models/community.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import { Preferences } from "../models/preferences.model.js";
import { User } from "../models/user.model.js";
import contractHelper from "../xion/contractConfig.js";
import AbstraxionAuth from "../xion/AbstraxionAuth.cjs";

export const getAllCommunity = async (req, res) => {
  try {
    // Find all communities and populate creator details
    const communities = await Community.find({})
      .populate("createdBy", "name email profileImage genre verified");

    // Get members for each community
    const communitiesData = await Promise.all(
      communities.map(async (community) => {
        const members = await CommunityMember.find({
          communityId: community._id
        }).populate('userId', 'name email profileImage');

        const communityData = community.toObject();
        communityData.members = members;
        return communityData;
      })
    );

    return res.status(200).json({
      status: "success",
      message: "Communities fetch successfully",
      data: communitiesData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching communities", error: error.message });
  }
};

export const getCommunityByArtistId = async (req, res) => {
  try {
    const { artistid } = req.params;
    if (!validator.isMongoId(artistid)) {
      return res
        .status(400)
        .json({ status: "failed", message: "invalid artist id format" });
    }

    const checkIfArtistExist = await Artist.findById(artistid);
    if (checkIfArtistExist !== null) {
      // Find community and populate creator details
      const communities = await Community.findOne({
        createdBy: new Types.ObjectId(artistid),
      }).populate("createdBy", "name email profileImage genre verified");

      if (!communities) {
        return res.status(200).json({
          status: "success",
          message: "Artist does not have a community",
          data: null,
        });
      }

      // Get community members with user details
      const members = await CommunityMember.find({
        communityId: communities._id
      }).populate('userId', 'name email profileImage');

      // Combine community data with members
      const communityData = communities.toObject();
      communityData.members = members;

      return res.status(200).json({
        status: "success",
        message: "successfully gotten a community",
        data: communityData,
      });
    } else {
      return res.status(404).json({
        status: "failed",
        message: `Artist with ID ${artistid} does not exist or does not have a community`,
      });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching community", error: error.message });
  }
};

export const checkIfTokenSymbolExist = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { artistAddress } = req.body;

    const getArtistCollection = await contractHelper.getCollection(
      artistAddress
    );

    const symbolChecker = await contractHelper.queryCollectionBySymbol(
      getArtistCollection.collection.contract_address,
      symbol
    );

    console.log(symbolChecker, "smbolds");

    const existingCollectible = await Community.findOne({
      "tribePass.communitySymbol": symbol,
    });

    if (existingCollectible) {
      return res.status(200).json({
        status: "success",
        message: "collectible already exist",
        data: null,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "collectible does not exist",
      data: null,
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
      communityName,
      description,
      coverImage,
      collectibleName,
      collectibleDescription,
      collectibleImage,
      collectibleType,
      artistId,
      communitySymbol,
    } = req.body;

    function isValidImageType(type) {
      const validTypes = [
        "PNG",
        "JPG",
        "WEBP",
        "png",
        "jpg",
        "webp",
        "GIF",
        "gif",
      ];
      return validTypes.includes(type.toUpperCase());
    }

    const requiredFields = {
      communityName: "Community name is required",
      description: "Description is required",
      coverImage: "Cover image is required",
      collectibleName: "Collectible name is required",
      collectibleImage: "Collectible image is required",
      collectibleDescription: "Collectible description is required",
      collectibleType: "Collectible type is required",
      artistId: "Artist ID is required",
      communitySymbol: "Community symbol is required",
    };
    const missingFields = Object.entries(requiredFields)
      .filter(([field]) => !req.body[field])
      .map(([, message]) => message);

    if (missingFields.length) {
      return res.status(401).json({
        message: "Missing required fields",
        errors: missingFields,
      });
    }

    const nextTokenId = await getNextNFTToken();

    if (!validator.isURL(coverImage)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid cover image URL" });
    }

    if (!validator.isURL(collectibleImage)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid collectible image URL" });
    }

    if (!validator.isMongoId(artistId)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid artist ID" });
    }

    if (collectibleImage.size && collectibleImage.size > 50 * 1024 * 1024) {
      return res.status(400).json({
        message: "Collectible image must be less than 50MB",
      });
    }

    const existingArtistCommunity = await Community.findOne({
      createdBy: artistId,
    });

    if (existingArtistCommunity === null) {
      const existingCommunity = await Community.findOne({ communityName });
      if (existingCommunity) {
        return res.status(400).json({
          status: "failed",
          message: "A community with this name already exists",
        });
      }

      const artist = await Artist.findById(artistId);
      if (!artist) {
        return res
          .status(404)
          .json({ status: "failed", message: "Artist not found" });
      }

      if (artist.verified === true) {
        const msg = {
            create_collection: {
              name: communityName,
              symbol: communitySymbol,
              collection_info: coverImage,
            },
          };

        await AbstraxionAuth.login(artist.email);
        console.log("artist email", artist.email);
        const execute = await AbstraxionAuth.executeSmartContract(
          "xion12s90sgu2vekmc25an5q72fvnm3jf2ncnx5xehjqd95ql2u284mxqdgykp0",
          msg,
          "auto"
        );

        console.log(execute, "execute");



        const transactionHash = execute.transactionHash;
        const artistWallet = execute.sender

        const CollectionMsg = {
            artist_collections: {
              artist: artistWallet,
            },
          };

        const getArtistCollection = await AbstraxionAuth.querySmartContract(
            "xion12s90sgu2vekmc25an5q72fvnm3jf2ncnx5xehjqd95ql2u284mxqdgykp0",
            CollectionMsg
          );

        console.log(getArtistCollection, "getArtistCollection");

        const collection = getArtistCollection.collections[0];
        const contractAddress = collection.contract_address;
        const contractSymbol = collection.symbol;

        const validateImageType = isValidImageType(collectibleType);

        if (validateImageType) {
          const community = new Community({
            communityName,
            description,
            coverImage,
            tribePass: {
              collectibleName,
              collectibleDescription,
              collectibleImage,
              collectibleType,
              contractAddress: contractAddress,
              communitySymbol: contractSymbol,
              transactionHash: transactionHash,
            },
            createdBy: artistId,
            NFTToken: nextTokenId,
          });

          await community.save();
          await community.populate(
            "createdBy",
            "name email profileImage genre verified"
          );

          return res.status(200).json({
            status: "success",
            message: "Community created successfully",
            data: community,
          });
        } else {
          return res.status(400).json({
            status: "failed",
            message: "Invalid image type",
          });
        }
      } else {
        return res.status(400).json({
          status: "failed",
          message: "This artist is not verified",
        });
      }
    } else {
      return res.status(400).json({
        status: "failed",
        message: "This artist already has a community",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      message: "Error creating tribe",
      error: error
        ? error.message.includes(`Symbol is already taken`)
          ? "Token Symbol is already taken"
          : error.message
        : error.message,
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
        message: "Community not found",
      });
    }

    if (community.createdBy.toString() !== artistId) {
      return res.status(403).json({
        message: "Only the community creator can delete the community",
      });
    }

    await CommunityMember.deleteMany({ communityId: communityId });
    await Community.findByIdAndDelete(communityId);

    return res.status(200).json({
      message: "Community successfully deleted",
      data: {
        communityId,
        name: community.name,
      },
    });
  } catch (error) {
    console.error("Error in deleteCommunity:", error);
    return res.status(500).json({
      message: "Error deleting community",
      error: error.message,
    });
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const { userId, communityId, type } = req.body;

    // Validate required fields
    if (!userId || !communityId || !type) {
      return res.status(400).json({
        status: "failed",
        message: "Missing required fields: userId, communityId, type are required",
      });
    }

    if (!["starknet", "xion"].includes(type)) {
      return res.status(400).json({
        status: "failed",
        message: "Type must be either 'starknet' or 'xion'",
      });
    }

    const user = await User.findById(userId);
    if (!validator.isMongoId(userId) || !user) {
      return res.status(400).json({
        status: "failed",
        message: !user ? "User not found" : "Invalid userID",
      });
    }

    // Get user's wallet address from their document
    const userAddress = user.wallets?.[type]?.address;
    if (!userAddress) {
      return res.status(400).json({
        status: "failed",
        message: `User does not have a ${type} wallet address`,
      });
    }

    if (!validator.isMongoId(communityId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid communityID",
      });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(400).json({
        status: "failed",
        message: "Community doesn't exist",
      });
    }

    const userAlreadyExistinCommunity = await CommunityMember.findOne({
      userId: userId,
      communityId: communityId,
    });

    if (userAlreadyExistinCommunity) {
      return res.status(400).json({
        status: "failed",
        message: "User already exists in community",
      });
    }

    // Login with user's email before minting
    await AbstraxionAuth.login(user.email);

    const mint = await AbstraxionAuth.mintPass(
      community.tribePass.contractAddress,
    );

    console.log(mint, "minted");

    // Create community member
    const communitymember = new CommunityMember({
      userId,
      communityId,
    });

    await communitymember.save();

    // Add NFT contract to user's collection
    user.nftContracts.push({
      contractAddress: community.tribePass.contractAddress,
      communityId: communityId
    });
    await user.save();

    // Update community member count
    community.memberCount += 1;
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "Successfully minted community",
      data: {
        communitymember,
        nftmint: mint.transactionHash,
        contractAddress: community.tribePass.contractAddress
      },
    });
  } catch (error) {
    console.error("Error in joinCommunity:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error joining community",
      error: error.message,
    });
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

    const userPreferences = await Preferences.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
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

    if (!userPreferences || userPreferences.length === 0) {
      return res.status(404).json({
        message: "No preferences found for this user",
      });
    }

    const genreNames = userPreferences.map((pref) => pref.genre.name);

    const genrePatterns = genreNames.map(
      (name) => new RegExp(name.trim(), "i")
    );

    const genreMap = userPreferences.reduce((acc, pref) => {
      acc[pref.genre.name] = {
        id: pref.genreId,
        name: pref.genre.name,
        image: pref.genre.image,
        description: pref.genre.description,
      };
      return acc;
    }, {});

    const genreBasedResults = {};
    genreNames.forEach((genreName) => {
      genreBasedResults[genreName] = [];
    });

    const artists = await Artist.aggregate([
      {
        $match: {
          $or: genrePatterns.map((pattern) => ({
            genre: pattern,
          })),
        },
      },
      {
        $addFields: {
          genreArray: {
            $split: ["$genre", ","],
          },
        },
      },
      {
        $lookup: {
          from: "communities",
          let: { artistId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$createdBy", "$$artistId"] },
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
            {
              $addFields: {
                memberCount: { $size: "$members" },
              },
            },
            {
              $match: {
                status: "active",
              },
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
                status: 1,
              },
            },
          ],
          as: "communities",
        },
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
          communityCount: { $size: "$communities" },
        },
      },
      {
        $sort: { communityCount: -1, name: 1 },
      },
    ]);

    // Organize artists by genre, handling multiple genres per artist
    artists.forEach((artist) => {
      if (artist.communities.length > 0) {
        // Get array of trimmed genres
        const artistGenres = artist.genre.split(",").map((g) => g.trim());

        // Add artist to each matching genre category
        artistGenres.forEach((artistGenre) => {
          genreNames.forEach((preferenceName) => {
            if (
              artistGenre.toLowerCase() === preferenceName.toLowerCase() &&
              genreBasedResults[preferenceName]
            ) {
              genreBasedResults[preferenceName].push({
                ...artist,
                communities: artist.communities,
              });
            }
          });
        });
      }
    });

    // Format the response with complete genre information
    const formattedResponse = Object.entries(genreBasedResults).map(
      ([genreName, artists]) => ({
        ...genreMap[genreName],
        artists: Array.from(new Set(artists.map((a) => a._id))).map((id) =>
          artists.find((a) => a._id.toString() === id.toString())
        ), // Remove duplicate artists within each genre
      })
    );

    return res.status(200).json({
      message: "Successfully retrieved artists and their communities by genre",
      data: {
        preferences: userPreferences.map((pref) => ({
          genreId: pref.genreId,
          genreName: pref.genre.name,
          genreImage: pref.genre.image,
          genreDescription: pref.genre.description,
        })),
        genreBasedCommunities: formattedResponse,
      },
    });
  } catch (error) {
    console.error("Error in getArtistCommunitiesByGenre:", error);
    return res.status(500).json({
      message: "Error fetching artists and their communities",
      error: error.message,
    });
  }
};

export const getTrendingArtistsByGenre = async (req, res) => {
  try {
    const { userId } = req.params;
    const timeframe = req.query.timeframe || "7d";

    const getDateThreshold = () => {
      const now = new Date();
      switch (timeframe) {
        case "24h":
          return new Date(now.setDate(now.getDate() - 1));
        case "7d":
          return new Date(now.setDate(now.getDate() - 7));
        case "30d":
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
          userId: new Types.ObjectId(userId),
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

    if (!userPreferences || userPreferences.length === 0) {
      return res.status(404).json({
        message: "No preferences found for this user",
      });
    }

    // Get genre names and create regex patterns
    const genreNames = userPreferences.map((pref) => pref.genre.name);
    const genrePatterns = genreNames.map(
      (name) => new RegExp(name.trim(), "i")
    );

    // Create genre mapping for response
    const genreMap = userPreferences.reduce((acc, pref) => {
      acc[pref.genre.name] = {
        id: pref.genreId,
        name: pref.genre.name,
        image: pref.genre.image,
        description: pref.genre.description,
      };
      return acc;
    }, {});

    const trendingArtists = await Artist.aggregate([
      {
        $match: {
          $or: genrePatterns.map((pattern) => ({
            genre: pattern,
          })),
        },
      },
      {
        $addFields: {
          genreArray: {
            $split: ["$genre", ","],
          },
        },
      },
      {
        $lookup: {
          from: "communities",
          let: { artistId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$createdBy", "$$artistId"] },
                status: "active",
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
            {
              $addFields: {
                memberCount: { $size: "$members" },
                recentMembers: {
                  $size: {
                    $filter: {
                      input: "$members",
                      as: "member",
                      cond: { $gte: ["$$member.createdAt", dateThreshold] },
                    },
                  },
                },
              },
            },
          ],
          as: "communities",
        },
      },
      {
        $match: {
          "communities.0": { $exists: true },
        },
      },
      {
        $addFields: {
          totalMembers: {
            $reduce: {
              input: "$communities",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.memberCount"] },
            },
          },
          totalRecentMembers: {
            $reduce: {
              input: "$communities",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.recentMembers"] },
            },
          },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: ["$totalMembers", { $multiply: ["$totalRecentMembers", 2] }],
          },
        },
      },
      {
        $sort: { trendingScore: -1 },
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
                createdAt: "$$community.createdAt",
              },
            },
          },
          totalMembers: 1,
          totalRecentMembers: 1,
          trendingScore: 1,
        },
      },
    ]);

    // Organize artists by genre
    const genreBasedResults = {};
    genreNames.forEach((genre) => {
      genreBasedResults[genre] = [];
    });

    trendingArtists.forEach((artist) => {
      const artistGenres = artist.genre.split(",").map((g) => g.trim());

      artistGenres.forEach((artistGenre) => {
        genreNames.forEach((preferenceName) => {
          if (
            artistGenre.toLowerCase() === preferenceName.toLowerCase() &&
            genreBasedResults[preferenceName]
          ) {
            genreBasedResults[preferenceName].push(artist);
          }
        });
      });
    });

    // Format response with trending artists for each genre
    const formattedResponse = Object.entries(genreBasedResults).map(
      ([genreName, artists]) => ({
        ...genreMap[genreName],
        artists: Array.from(new Set(artists.map((a) => a._id)))
          .map((id) => artists.find((a) => a._id.toString() === id.toString()))
          .slice(0, 10), // Get top 10 trending artists per genre after deduplication
      })
    );

    return res.status(200).json({
      message: "Successfully retrieved trending artists and their communities",
      data: {
        timeframe,
        preferences: userPreferences.map((pref) => ({
          genreId: pref.genreId,
          genreName: pref.genre.name,
          genreImage: pref.genre.image,
          genreDescription: pref.genre.description,
        })),
        trendingByGenre: formattedResponse,
      },
    });
  } catch (error) {
    console.error("Error in getTrendingArtistsByGenre:", error);
    return res.status(500).json({
      message: "Error fetching trending artists",
      error: error.message,
    });
  }
};

const getNextNFTToken = async () => {
  try {
    const lastCommunity = await Community.findOne()
      .sort({ NFTToken: -1 })
      .select("NFTToken")
      .lean();

    return lastCommunity?.NFTToken ? lastCommunity.NFTToken + 1 : 1;
  } catch (error) {
    console.error("Error fetching the last NFT token:", error);
    throw new Error("Unable to calculate the next NFT token");
  }
};
