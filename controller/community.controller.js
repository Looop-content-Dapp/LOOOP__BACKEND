import { get, Types } from "mongoose";
import validator from "validator";
import mongoose from "mongoose";
import {
  TokenboundClient,
  TBAVersion,
  TBAChainID,
} from "starknet-tokenbound-sdk";

import { Artist } from "../models/artist.model.js";
import { Community } from "../models/community.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import { Preferences } from "../models/preferences.model.js";
import { User } from "../models/user.model.js";
import contractHelper from "../xion/contractConfig.js";
import AbstraxionAuth from "../xion/AbstraxionAuth.js";
import { Post } from "../models/post.model.js";
import { Follow } from "../models/followers.model.js";
import crypto from "crypto";
import { PassSubscription } from "../models/passSubscription.model.js";
import Transaction from '../models/Transaction.model.js';
import { ArtistSubscriptionPlan } from "../models/artistSubscriptionPlan.model.js";
import { starknetService } from "../services/starknet.service.js";
import { CallData } from "starknet";

const abstraxionAuth = new AbstraxionAuth();

export const getAllCommunity = async (req, res) => {
  try {
    // Find all communities and populate creator details
    const communities = await Community.find({}).populate(
      "createdBy",
      "name email profileImage genre verified"
    );

    // Get members for each community
    const communitiesData = await Promise.all(
      communities.map(async (community) => {
        const members = await CommunityMember.find({
          communityId: community._id,
        }).populate("userId", "name email profileImage");

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
        communityId: communities._id,
      }).populate("userId", "name email profileImage");

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
  let isResponseSent = false;

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

      // Get the user associated with the artist to access their wallet
      const user = await User.findOne({ email: artist.email });
      if (!user) {
        return res
          .status(404)
          .json({ status: "failed", message: "User account for artist not found" });
      }

      // Check if user has a Starknet wallet
      if (!user.wallets || !user.wallets.starknet || !user.wallets.starknet.address) {
        return res.status(400).json({
          status: "failed",
          message: "Artist does not have a Starknet wallet configured",
        });
      }

      if (artist.verified === true) {
        try {
            console.log(artist.email, "this is the email")

        const contractCaller = await starknetService.getUserWalletInfo(artist.email);

        if (!contractCaller || !contractCaller.address || !contractCaller.privateKey) {
          if (!isResponseSent) {
            isResponseSent = true;
            return res.status(400).json({
              status: "failed",
              message: "Could not retrieve wallet information for the artist"
            });
          }
        }

        console.log("this is the wallet calling function", contractCaller)

 // Helper function to convert string to ByteArray for long strings
  function stringToByteArray(str) {
    if (str.length <= 31) {
      // Use short string for strings <= 31 characters
      return starknetService.stringToFelt(str);
    } else {
      // Use ByteArray for longer strings
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      return {
        data: Array.from(bytes),
        pending_word: 0,
        pending_word_len: 0
      };
    }
  }

  // Process the parameters properly
  const processedCalldata = {
    pauser: user.wallets.starknet.address,
    name: stringToByteArray(collectibleName),  // Short string, should work
    symbol: stringToByteArray(communitySymbol), // Short string, should work
    collection_details: [{
      name: stringToByteArray(collectibleName),
      description: stringToByteArray(collectibleDescription), // Might be long
      image: stringToByteArray(collectibleImage), // Long URL - needs ByteArray
      type: stringToByteArray(collectibleType), // Short string
      communityName: stringToByteArray(communityName),
      communitySymbol: stringToByteArray(communitySymbol),
      communityImage: stringToByteArray(coverImage), // Long URL - needs ByteArray
      communityDescription: stringToByteArray(description), // Long description - needs ByteArray
    }]
  };

  console.log("Processed calldata:", processedCalldata);

//   const collectionContractCall = await starknetService.executeTransaction(
//     "0x0292010c95c853d3e3238c47367e04d07939d9f48274c53da78ed02a8266a17b",
//     "withdraw",
//     [
//         "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
//         "0x03e5bcbbb9834dd78da8c0dc114f071852ebe58d7e7d4e6732810542de61180d",
//         1000000000000000000,
//     ],
//     {
//       address: "0x0620fd15e0b464c174933b5235c72a50376379ee1528719848e144385d0a1ed4",
//       privateKey: "0x05d67e95f8d5913249452a410db389110c390a36eb0e2ecb092c670ba945b8b9"
//     }
//   );

//   const collectionContractCall = await starknetService.executeTransaction(
//     "0x0292010c95c853d3e3238c47367e04d07939d9f48274c53da78ed02a8266a17b",
//     "create_collection",
//     [
//         "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
//         "wizkid22",
//         "WIZZ",
//         "Wiskid valid"
//     ],
//     {
//       address: "0x03e5bcbbb9834dd78da8c0dc114f071852ebe58d7e7d4e6732810542de61180d",
//       privateKey: "0x038e50caa562f48b04e1ed76e81abbe51a45346f0491d26d9e6fb2b9f11fd036"
//     }
//   );

//   console.log("Collection contract call result:", collectionContractCall);


  const deployContractCall = await starknetService.executeTransaction(
    "0x0292010c95c853d3e3238c47367e04d07939d9f48274c53da78ed02a8266a17b",
    "deploy_account",
    [
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        "0x03e5bcbbb9834dd78da8c0dc114f071852ebe58d7e7d4e6732810542de61180d",
         1,
    ],
    {
      address: "0x0620fd15e0b464c174933b5235c72a50376379ee1528719848e144385d0a1ed4",
      privateKey: "0x05d67e95f8d5913249452a410db389110c390a36eb0e2ecb092c670ba945b8b9"
    }
  );

    //   const deployResult = await starknetService.deployUserWallet("wizkid21@gmail.com");

    //     console.log("this is the collection contract call", deployResult)

          const validateImageType = isValidImageType(collectibleType);

          if (validateImageType) {
            // Start a MongoDB session for transaction consistency
            // const session = await mongoose.startSession();
            // session.startTransaction();

            // try {
            // //   Create community
            //   const community = new Community({
            //     communityName,
            //     description,
            //     coverImage,
            //     tribePass: {
            //       collectibleName,
            //       collectibleDescription,
            //       collectibleImage,
            //       collectibleType,
            //       contractAddress: "0x3635c6162f978c1a502b0fbcdf8626f2eacd7f1457967392a3b01d2f4803c6d",
            //       communitySymbol: "StarBoy",
            //       transactionHash: "0x7513d791846bcf5d724fac0208ecbaaca816f67dc73b38d685d0b71c9f3d034",
            //     },
            //     createdBy: artistId,
            //   });

            //   await community.save({ session });

            //   // Create default subscription plan for the artist
            //   const defaultPlan = new ArtistSubscriptionPlan({
            //     artistId,
            //     name: `${communityName} Subscription`,
            //     description: `Monthly subscription to ${communityName} community`,
            //     price: {
            //       amount: 9.99, // Default price
            //       currency: 'USD'
            //     },
            //     duration: 30, // 30 days
            //     features: [
            //       'Access to exclusive content',
            //       'Community membership',
            //       'Early access to releases'
            //     ],
            //     splitPercentage: {
            //       artist: 85,
            //       platform: 15
            //     },
            //     status: 'active'
            //   });

            //   await defaultPlan.save({ session });

            //   // Commit transaction
            //   await session.commitTransaction();

            //   // Populate community data for response
            //   await community.populate(
            //     "createdBy",
            //     "name email profileImage genre verified"
            //   );

            //   return res.status(200).json({
            //     status: "success",
            //     message: "Community created successfully with subscription plan",
            //     data: {
            //       community,
            //       subscriptionPlan: defaultPlan
            //     }
            //   });
            // } catch (error) {
            //   // Abort transaction on error
            //   await session.abortTransaction();
            //   throw error;
            // } finally {
            //   session.endSession();
            // }
          } else if (!isResponseSent) {
            isResponseSent = true;
            return res.status(400).json({
              status: "failed",
              message: "Invalid image type",
            });
          }
        } catch (error) {
          console.error("Tokenbound execution error:", error);
          if (!isResponseSent) {
            isResponseSent = true;
            return res.status(500).json({
              status: "failed",
              message: "Error executing smart contract",
              error: error.message,
            });
          }
        }
      } else if (!isResponseSent) {
        isResponseSent = true;
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
    if (!isResponseSent) {
      isResponseSent = true;
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
      const { userId, communityId, type, paymentMethod = "card" } = req.body;

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

      // Create a unique reference ID for the transaction
      const referenceId = `MINT_${userAddress}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Create pending transaction record
      const transaction = await Transaction.create({
        userId: userId,
        referenceId,
        amount: 5000000, // 5 USDC
        currency: "USDC",
        status: "pending",
        paymentMethod,
        type: "mint_pass",
        blockchain: "Starknet",
        title: "Tribe Pass Minting",
        message: "Minting tribe pass on Starknet network",
        metadata: {
          communityId: community.tribePass.contractAddress,
        },
      });



      try {
        console.log(community.tribePass.contractAddress, "community.tribePass.contractAddress");

        const account = {
            address: "0x07e3a9c87437b85faaf4b4baba09b779c4b2850c86470405866991b8cfaf220f",
            privateKey: "0x020822010d5a763023da167f93e6c745abdf84389c8331274ad0e3e3e002e911"
        }

        const mint_pass = await starknetService.executeTransaction(
            community.tribePass.contractAddress,
            "mint_ticket_nft",
            [
                "0x07e3a9c87437b85faaf4b4baba09b779c4b2850c86470405866991b8cfaf220f"
            ],
            account
          );

          console.log(mint_pass, "whiteList");

        // Update transaction with success status
        transaction.status = "success";
        transaction.transactionHash = mint_pass.transactionHash;
        await transaction.save();

        // Create subscription record
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        const nextRenewalDate = new Date(expiryDate);
        nextRenewalDate.setDate(nextRenewalDate.getDate() - 7);

        await PassSubscription.create({
            userId: userId,
            communityId: communityId,
            contractAddress: community.tribePass.contractAddress,
            tokenId: mint_pass?.eventData?.tokenId,
            expiryDate,
            renewalPrice: 5000000,
            currency: "USDC",
            status: "active",
            startDate: new Date(),
            lastRenewalDate: new Date(),
            nextRenewalDate,
            paymentStatus: "paid",
            paymentMethod,
            transactionHash: mint_pass.transactionHash,
            collectibelType: "Tribe Pass",
            usageStats: {
              lastUsed: new Date(),
              usageCount: 0
            },
            notifications: [{
              type: "payment_success",
              sentAt: new Date(),
              read: false
            }]
          });

        // Create community member
        const communitymember = new CommunityMember({
          userId,
          communityId,
        });
        await communitymember.save();

        // Update user's NFT contracts
        await User.findByIdAndUpdate(
          userId,
          {
            $push: {
              nftContracts: {
                contractAddress: community.tribePass.contractAddress,
                communityId: communityId,
              },
            },
          },
          { new: true }
        );

        // Update community member count
        await Community.findByIdAndUpdate(communityId, {
          $inc: { memberCount: 1 },
        });

        return res.status(200).json({
          status: "success",
          message: "Successfully joined community",
          data: {
            mint_pass,
          }
        });

      } catch (error) {
        // Update transaction with failed status
        transaction.status = "failed";
        transaction.message = error.message;
        await transaction.save();
        throw error;
        return
      }

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
    const { query, filter } = req.query;
    const searchQuery = query || "";

    // Search Communities
    const communities = await Community.aggregate([
      {
        $match: {
          $or: [
            { communityName: { $regex: searchQuery, $options: "i" } },
            { description: { $regex: searchQuery, $options: "i" } },
          ],
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "createdBy",
          foreignField: "_id",
          as: "artist",
        },
      },
      {
        $unwind: "$artist",
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
        $lookup: {
          from: "users",
          localField: "members.userId",
          foreignField: "_id",
          as: "memberDetails",
        },
      },
      {
        $project: {
          _id: 1,
          communityName: 1,
          description: 1,
          coverImage: 1,
          memberCount: 1,
          tribePass: 1, // Include tribePass details
          artist: {
            _id: "$artist._id",
            name: "$artist.name",
            profileImage: "$artist.profileImage",
            verified: "$artist.verified",
          },
          members: {
            $map: {
              input: "$memberDetails",
              as: "member",
              in: {
                _id: "$$member._id",
                name: "$$member.name",
                email: "$$member.email",
                profileImage: "$$member.profileImage",
              },
            },
          },
          type: { $literal: "community" },
        },
      },
    ]);

    // Search Posts
    const posts = await Post.aggregate([
        {
          $match: {
            $or: [
              { content: { $regex: searchQuery, $options: "i" } },
              { title: { $regex: searchQuery, $options: "i" } },
            ],
            status: "published",
            visibility: "public",
          },
        },
        {
          $lookup: {
            from: "artists",
            localField: "artistId",
            foreignField: "_id",
            as: "artist",
          },
        },
        {
          $lookup: {
            from: "communities",
            localField: "communityId",
            foreignField: "_id",
            as: "community",
          },
        },
        {
          $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "postId",
            as: "likes",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "likes.userId",
            foreignField: "_id",
            as: "likeUsers",
          },
        },
        {
          $lookup: {
            from: "comments",
            let: { postId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$postId", "$$postId"] },
                      { $eq: ["$parentCommentId", null] },
                    ],
                  },
                },
              },
              {
                $sort: { createdAt: -1 },
              },
              {
                $limit: 3,
              },
              {
                $lookup: {
                  from: "users",
                  localField: "userId",
                  foreignField: "_id",
                  as: "user",
                },
              },
              {
                $unwind: "$user",
              },
              {
                $lookup: {
                  from: "comments",
                  let: { commentId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ["$parentCommentId", "$$commentId"] },
                      },
                    },
                    {
                      $sort: { createdAt: -1 },
                    },
                    {
                      $limit: 2,
                    },
                    {
                      $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user",
                      },
                    },
                    {
                      $unwind: "$user",
                    },
                  ],
                  as: "replies",
                },
              },
            ],
            as: "comments",
          },
        },
        {
          $unwind: "$artist",
        },
        {
          $unwind: "$community",
        },
        {
          $project: {
            _id: 1,
            content: 1,
            title: 1,
            media: {
              $filter: {
                input: "$media",
                as: "m",
                cond: { $in: ["$$m.type", ["image", "video"]] },
              },
            },
            createdAt: 1,
            artistId: {
              _id: "$artist._id",
              name: "$artist.name",
              email: "$artist.email",
              profileImage: "$artist.profileImage",
              genre: "$artist.genre",
              verified: "$artist.verified",
              bio: "$artist.bio",
              socialLinks: "$artist.socialLinks",
              stats: "$artist.stats",
            },
            communityId: {
              _id: "$community._id",
              name: "$community.communityName",
              description: "$community.description",
              coverImage: "$community.coverImage",
              tribePass: "$community.tribePass",
            },
            likes: {
              $map: {
                input: "$likeUsers",
                as: "user",
                in: {
                  userId: "$$user._id",
                  email: "$$user.email",
                  profileImage: "$$user.profileImage",
                  bio: "$$user.bio",
                  name: "$$user.name",
                  username: "$$user.username",
                },
              },
            },
            likeCount: { $size: "$likes" },
            comments: {
              $map: {
                input: "$comments",
                as: "comment",
                in: {
                  _id: "$$comment._id",
                  content: "$$comment.content",
                  createdAt: "$$comment.createdAt",
                  user: {
                    _id: "$$comment.user._id",
                    email: "$$comment.user.email",
                    profileImage: "$$comment.user.profileImage",
                    bio: "$$comment.user.bio",
                    name: "$$comment.user.name",
                    username: "$$comment.user.username",
                  },
                  replies: "$$comment.replies",
                  replyCount: { $size: "$$comment.replies" },
                },
              },
            },
            commentCount: {
              $size: "$comments",
            },
            type: { $literal: "post" },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ]);

    // Search Artists
    const artists = await Artist.aggregate([
      {
        $match: {
          name: { $regex: searchQuery, $options: "i" },
        },
      },
      {
        $lookup: {
          from: "communities",
          localField: "_id",
          foreignField: "createdBy",
          as: "communities",
        },
      },
      {
        $lookup: {
          from: "communitymembers",
          localField: "communities._id",
          foreignField: "communityId",
          as: "tribeStars",
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $lookup: {
          from: "genres",
          localField: "genres",
          foreignField: "_id",
          as: "genreDetails",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          profileImage: 1,
          biography: 1,
          verified: 1,
          verifiedAt: 1,
          monthlyListeners: 1,
          popularity: 1,
          websiteurl: 1,
          socialLinks: 1,
          roles: 1,
          labels: 1,
          country: 1,
          city: 1,
          genres: "$genreDetails",
          type: { $literal: "artist" },
          tribeStars: {
            $toString: {
              $concat: [
                { $toString: { $divide: [{ $size: "$tribeStars" }, 1000] } },
                "K",
              ],
            },
          },
          followers: "$followers.follower",
          followersCount: { $size: "$followers" },
          topTracks: {
            $slice: ["$topTracks", 5], // Get top 5 tracks
          },
          communities: {
            $size: "$communities",
          },
        },
      },
    ]);

    // Filter results based on type
    let results;
    switch (filter?.toLowerCase()) {
      case "posts":
        results = posts;
        break;
      case "tribes":
        results = communities;
        break;
      case "artistes":
        results = artists;
        break;
      default:
        results = [...communities, ...posts, ...artists];
    }

    return res.status(200).json({
      status: "success",
      message: "Search completed successfully",
      data: {
        results,
        total: results.length,
        filter: filter || "all",
      },
    });
  } catch (error) {
    console.error("Error searching:", error);
    return res.status(500).json({
      status: "error",
      message: "Error performing search",
      error: error.message,
    });
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

export const getFollowedArtistsCommunities = async (req, res) => {
  try {
    const { userId } = req.params;

    // First get all artists that the user follows using the Follow model
    const followedArtists = await Follow.find({
      follower: userId,
    }).populate({
      path: "following",
      model: "artist",
      select: "_id name email profileImage genre verified",
    });

    if (!followedArtists.length) {
      return res.status(200).json({
        status: "success",
        message: "User is not following any artists",
        data: [],
      });
    }

    // Get the artist IDs
    const followedArtistIds = followedArtists.map(
      (follow) => follow.following._id
    );

    // Find communities created by followed artists
    const communities = await Community.find({
      createdBy: { $in: followedArtistIds },
    })
      .populate({
        path: "createdBy",
        model: "artist",
        select: "name email profileImage genre verified",
      })
      // Remove the members population since it's causing the error
      .lean(); // Convert to plain JavaScript objects

    // Now fetch members separately
    const communitiesWithMembers = await Promise.all(
      communities.map(async (community) => {
        const members = await CommunityMember.find({
          communityId: community._id,
        })
          .populate({
            path: "userId",
            model: "user",
            select: "name email profileImage",
          })
          .lean();

        return {
          ...community,
          members: members,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      message: "Successfully fetched followed artists' communities",
      data: communitiesWithMembers,
    });
  } catch (error) {
    console.error("Error in getFollowedArtistsCommunities:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error fetching followed artists' communities",
      error: error.message,
    });
  }
};

export const getUserCommunities = async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Get communities user has joined with members
      const userCommunities = await CommunityMember.aggregate([
        {
          $match: { userId: new Types.ObjectId(userId) }
        },
        {
          $lookup: {
            from: 'communities',
            localField: 'communityId',
            foreignField: '_id',
            as: 'community'
          }
        },
        {
          $unwind: '$community'
        },
        {
          $lookup: {
            from: 'artists',
            localField: 'community.createdBy',
            foreignField: '_id',
            as: 'artist'
          }
        },
        {
          $unwind: '$artist'
        },
        {
          $lookup: {
            from: 'communitymembers',
            localField: 'community._id',
            foreignField: 'communityId',
            as: 'members'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'members.userId',
            foreignField: '_id',
            as: 'memberDetails'
          }
        },
        {
          $project: {
            _id: '$community._id',
            name: '$community.communityName',
            description: '$community.description',
            coverImage: '$community.coverImage',
            memberCount: { $size: '$members' },
            artist: {
              _id: '$artist._id',
              name: '$artist.name',
              profileImage: '$artist.profileImage',
              verified: '$artist.verified'
            },
            members: {
              $slice: [{
                $map: {
                  input: '$memberDetails',
                  as: 'member',
                  in: {
                    _id: '$$member._id',
                    username: '$$member.username',
                    profileImage: '$$member.profileImage'
                  }
                }
              }, 3] // Get first 3 members for preview
            },
            joinedAt: '$joinDate'
          }
        },
        {
          $sort: { joinedAt: -1 }
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit)
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      // Get recent posts from these communities
      const communityIds = userCommunities.map(c => c._id);
      const recentPosts = await Post.aggregate([
        {
          $match: {
            communityId: { $in: communityIds.map(id => new Types.ObjectId(id)) }
          }
        },
        {
          $lookup: {
            from: 'artists',
            localField: 'artistId',
            foreignField: '_id',
            as: 'artist'
          }
        },
        {
          $unwind: '$artist'
        },
        {
          $lookup: {
            from: 'communities',
            localField: 'communityId',
            foreignField: '_id',
            as: 'community'
          }
        },
        {
          $unwind: '$community'
        },
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likes'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'postId',
            as: 'comments'
          }
        },
        {
          $project: {
            _id: 1,
            content: 1,
            title: 1,
            postType: 1,
            type: { $literal: "post" },
            media: {
              $map: {
                input: "$media",
                as: "m",
                in: {
                  _id: "$$m._id",
                  type: "$$m.type",
                  url: "$$m.url",
                  mimeType: "$$m.mimeType",
                  width: "$$m.width",
                  height: "$$m.height"
                }
              }
            },
            artistId: {
              _id: '$artist._id',
              name: '$artist.name',
              email: '$artist.email',
              profileImage: '$artist.profileImage',
              verified: '$artist.verified'
            },
            communityId: {
              _id: '$community._id',
              description: '$community.description',
              coverImage: '$community.coverImage'
            },
            tags: 1,
            category: 1,
            visibility: 1,
            likeCount: { $size: '$likes' },
            commentCount: { $size: '$comments' },
            shareCount: { $ifNull: ['$shareCount', 0] },
            status: 1,
            genre: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
            id: '$_id',
            comments: {
              $slice: ['$comments', 5] // Get latest 5 comments
            },
            likes: {
              $map: {
                input: '$likes',
                as: 'like',
                in: {
                  _id: '$$like._id',
                  userId: {
                    _id: '$$like.userId',
                    email: '$$like.userEmail',
                    username: '$$like.username',
                    profileImage: '$$like.userProfileImage',
                    bio: '$$like.userBio'
                  },
                  postId: '$$like.postId',
                  itemType: { $literal: 'post' },
                  createdAt: '$$like.createdAt',
                  __v: '$$like.__v'
                }
              }
            },
            hasLiked: {
              $in: [new Types.ObjectId(userId), '$likes.userId']
            }
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $limit: 20
        }
      ]);

      return res.status(200).json({
        status: 'success',
        message: 'Successfully fetched user feed',
        data: {
          communities: userCommunities.map(community => ({
            id: community._id,
            name: community.name,
            description: community.description,
            coverImage: community.coverImage,
            artist: community.artist,
            memberCount: community.memberCount,
            members: community.members,
            joinedAt: community.joinedAt
          })),
          posts: recentPosts,
          currentPage: parseInt(page),
          totalPages: Math.ceil(recentPosts.length / parseInt(limit)),
          totalPosts: recentPosts.length
        }
      });

    } catch (error) {
      console.error('Error in getUserCommunities:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error fetching user communities',
        error: error.message
      });
    }
  };
