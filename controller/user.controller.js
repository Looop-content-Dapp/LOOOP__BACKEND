import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";
import { config } from "dotenv";
import {
  TokenboundClient,
  TBAVersion,
  TBAChainID,
} from "starknet-tokenbound-sdk";
import { User } from "../models/user.model.js";
import { Preferences } from "../models/preferences.model.js";
import { FaveArtist } from "../models/faveartist.model.js";
import { Artist } from "../models/artist.model.js";
import { Subscriber } from "../models/subcriber.model.js";
import { Follow } from "../models/followers.model.js";
import { Friends } from "../models/friends.model.js";
import { matchUser } from "../utils/helpers/searchquery.js";
import { LastPlayed } from "../models/lastplayed.model.js";
import { walletService } from "../xion/walletservice.js";
// import { ApiError } from "../utils/helpers/ApiError.js";
import { encryptPrivateKey } from "../utils/helpers/encyption.cjs";
import sendEmail from "../script.cjs"; // Make sure this path matches your email utility location

import { Genre } from "../models/genre.model.js";
import { Community } from "../models/community.model.js";
// Loads .env
config();

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    return res.status(200).json({
      message: "successfully get all users",
      data: users,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid user ID" });
    }

    const user = await User.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.id,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "preferences",
          localField: "_id",
          foreignField: "userId",
          as: "preferences",
        },
      },
      {
        $unwind: {
          path: "$faveArtists",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "follower",
          as: "following",
        },
      },
      {
        $lookup: {
          from: "friends",
          localField: "_id",
          foreignField: "userId",
          as: "friends",
        },
      },
      {
        $addFields: {
          following: { $size: "$following" },
          friendsCount: { $size: "$friends" },
          artistPlayed: { $size: "$friends" },
        },
      },
    ]);

    const favouriteArtists = await FaveArtist.find({
      userId: new Types.ObjectId(req.params.id),
    });

    const processedFavorites = new Set();
    const uniqueFavorites = favouriteArtists.filter((favorite) => {
      const artistId = favorite.artistId.toString();
      if (!processedFavorites.has(artistId)) {
        processedFavorites.add(artistId);
        return true;
      }
      return false;
    });

    if (user.length === 0) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    const isArtist = await Artist.findOne({ userId: user[0]._id });

    const userData = {
      ...user[0],
      artist: isArtist === null ? null : isArtist?.id,
      favouriteArtists: uniqueFavorites,
    };
    delete userData.password;

    return res.status(200).json({
      status: "success",
      message: "User fetched successfully",
      data: userData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

const checkIfUserNameExist = async (req, res) => {
  try {
    const { username } = req.body;

    if (username == "") {
      console.log("username is needed");
      return "username is needed";
    }

    const existingUser = await User.findOne({ username });
    return res.status(200).json({
      message: "successfully checked if username is",
      data: { existingUser },
    });
  } catch (error) {
    console.log("Error check if username exist", error.message);
    return res
      .status(500)
      .json({ message: "Error checking username", error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const generateSimpleSalt = () => {
      return Math.random().toString(36).substring(2, 10);
    };

    const account = {
      address: process.env.ACCT_ADDRESS,
      privateKey: process.env.PRIVATE_KEY,
    };

    const options = {
      walletClient: account,
      version: TBAVersion.V3,
      chain_id: TBAChainID.sepolia,
      jsonRPC:
        "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/SJrfoNSORPvz7PkhNneqhqTpnielFNxS",
    };

    const tokenbound = new TokenboundClient(options);
    const xion = await walletService.createXionWallet();

    if (password == "" || email == "" || username == "") {
      return res
        .status(401)
        .json({ message: "Password, Email and username is required" });
    }

    if (username) {
      const shortSalt = generateSimpleSalt();

      let starknetTokenBoundAccount = await tokenbound.createAccount({
        tokenContract: process.env.NFT_CONTRACT_ADDRESS,
        tokenId: process.env.NFT_TOKEN_ID,
        salt: shortSalt,
      });

      if (xion || starknetTokenBoundAccount) {
        const user = new User({
          email,
          username,
          password: hashedPassword,
          wallets: {
            starknet: starknetTokenBoundAccount.account,
            xion: xion.address,
          },
        });

        await user.save();

        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        return res.status(200).json({
          status: "success",
          message: "successfully created a user",
          data: { user: userWithoutPassword },
        });
      }
    }
  } catch (error) {
    console.log(error, "error");
    return res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

const createGenresForUser = async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID",
      });
    }

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({
        status: "failed",
        message:
          "Invalid preferences array, preference should be an array of string(s)",
      });
    }

    if (preferences.length === 0) {
      return res.status(400).json({
        status: "failed",
        message:
          "Invalid preferences array, preference should be an array of string(s)",
      });
    }

    const user = await User.findById(userId);

    if (user === null) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    const parsePeferences = JSON.parse(JSON.stringify(preferences));

    for (let i = 0; i < parsePeferences.length; i++) {
      if (!validator.isMongoId(parsePeferences[i])) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid genre ID",
        });
      }

      const genreExist = await Genre.findById(parsePeferences[i]);
      if (genreExist === null) {
        return res.status(400).json({
          status: "failed",
          message: "Genre does not exist",
        });
      }

      const element = parsePeferences[i];
      const peference = new Preferences({
        genreId: element,
        userId: user.id,
      });
      await peference.save();
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully saved all genres for user",
      data: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating all genres for user",
      error: error.message,
    });
  }
};

const getArtistBasedOnUserGenre = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const userGenresPreferences = await Preferences.find({ userId });
    if (userGenresPreferences.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "No genres found for user",
      });
    }

    const findFavourites = await FaveArtist.find({ userId });
    const favouriteArtistIds = findFavourites.map((fav) =>
      fav.artistId.toString()
    );

    const processedGenres = new Set();
    const genreArtistData = [];

    for (const preference of userGenresPreferences) {
      const genre = await Genre.findById(preference.genreId);
      if (!genre || processedGenres.has(genre._id.toString())) {
        continue;
      }

      processedGenres.add(genre._id.toString());

      const artists = await Artist.find({ genres: { $in: [genre._id] } });
      const artistMap = new Map();

      const artistsWithCommunity = await Promise.all(
        artists.map(async (artist) => {
          if (artistMap.has(artist._id.toString())) return null;
          artistMap.set(artist._id.toString(), true);

          const artistCommunity = await Community.findOne({
            createdBy: artist._id,
          });

          return {
            id: artist._id,
            name: artist.name,
            tribeName: artistCommunity?.communityName || "Unknown Tribe",
            tribestars: artistCommunity?.NFTToken || 0,
            profileImage: artist.profileImage || "default_image_url",
            isFavourite: favouriteArtistIds.includes(artist._id.toString()),
          };
        })
      );

      genreArtistData.push({
        genreName: genre.name,
        artists: artistsWithCommunity.filter(Boolean),
      });
    }

    if (genreArtistData.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "No artist data found for user genres",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved artists based on user genres",
      data: genreArtistData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      message: "Error fetching artists based on genre of user",
      error: error.message,
    });
  }
};

const createUserFaveArtistBasedOnGenres = async (req, res) => {
  try {
    const { userId, faveArtist } = req.body;
    const parseFaveArtist = JSON.parse(JSON.stringify(faveArtist));

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    for (let i = 0; i < parseFaveArtist.length; i++) {
      const findArtist = await Artist.findOne({
        _id: parseFaveArtist[i],
      });
      if (findArtist) {
        const element = parseFaveArtist[i];

        const existingFave = await FaveArtist.findOne({
          artistId: element,
          userId: userId,
        });

        if (existingFave) {
          await FaveArtist.deleteOne({
            artistId: element,
            userId: userId,
          });
        } else {
          const faveArtist = new FaveArtist({
            artistId: element,
            userId: userId,
          });
          await faveArtist.save();
        }
      } else {
        return res.status(404).json({
          status: "failed",
          message: "Artist not found",
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully updated user's favorite artists",
      data: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating user's favorite artists",
      error: error.message,
    });
  }
};

const subcribeToPremium = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findOneAndUpdate(
      {
        _id: userId,
      },
      {
        $set: {
          isPremium: user.isPremium == true ? false : true,
        },
      }
    );

    return res.status(200).json({
      message: `successfully ${
        user.isPremium == true ? "unsubcribe from" : "subcribe to"
      } premium`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error subcribing to premium",
      error: error.message,
    });
  }
};

const subcribeToArtist = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const alreadyFriends = await Subscriber.findOne({
      userId: userId,
      artistId: artistId,
    });

    if (alreadyFriends) {
      await Subscriber.deleteOne({
        userId: userId,
        artistId: artistId,
      });
    } else {
      const subcriber = await Subscriber({
        userId,
        artistId,
      });
      await subcriber.save();
    }

    return res.status(200).json({
      message: `successfully ${
        alreadyFriends ? "unsubcribed" : "subcribed"
      } to artist`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error subcribing to artist",
      error: error.message,
    });
  }
};

const getArtistUserSubcribeTo = async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await Subscriber.find({
      userId: userId,
    });

    return res.status(200).json({
      message: `successfully gotten data`,
      data,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
};

const addToFavorite = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const faveExist = await FaveArtist.findOne({
      userId: userId,
      artistId: artistId,
    });

    if (!faveExist) {
      const data = new FaveArtist({
        userId: userId,
        artistId: artistId,
      });
      await data.save();
    } else {
      await FaveArtist.deleteOne({
        userId: userId,
        artistId: artistId,
      });
    }

    return res.status(200).json({
      message: "success",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
};

const isArtistFave = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const data = await FaveArtist.find({
      userId: userId,
      artistId: artistId,
    });

    return res.status(200).json({
      bool: data.length > 0 ? true : false,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
};

const isUserFollowing = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const data = await Follow.find({
      follower: userId,
      following: artistId,
    });

    return res.status(200).json({
      bool: data.length > 0 ? true : false,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.deleteOne({
      _id: userId,
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

const addFriend = async (req, res) => {
  try {
    const { userId, friendId } = req.params;

    const alreadyFriends = await Friends.findOne({
      friendId: friendId,
      userId: userId,
    });

    if (alreadyFriends) {
      await Friends.deleteOne({
        friendId: friendId,
        userId: userId,
      });
    } else {
      const follower = await Friends({
        friendId: friendId,
        userId: userId,
      });
      await follower.save();
    }

    return res.status(200).json({
      message: `successfully ${alreadyFriends ? "unfriend" : "friend"} user`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

const getUserFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const matchUserObj = matchUser({ id: userId, name: "userId" });

    const friends = await Friends.aggregate([
      {
        ...matchUserObj,
      },
      {
        $lookup: {
          from: "users",
          localField: "friendId",
          foreignField: "_id",
          as: "friendData",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "friendData._id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$friendData",
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          userId: "$user._id",
          name: "$user.email",
          profileImage: "$user.profileImage",
          // name: "$friendData.name",
        },
      },
    ]);

    return res.status(200).json({
      message: `success`,
      friends,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.aggregate([
      {
        $match: { email: email },
      },
      {
        $lookup: {
          from: "preferences",
          localField: "_id",
          foreignField: "userId",
          as: "preferences",
        },
      },
      {
        $lookup: {
          from: "faveartists",
          localField: "_id",
          foreignField: "userId",
          as: "faveArtists",
        },
      },
      {
        $unwind: {
          path: "$faveArtists",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "follower",
          as: "following",
        },
      },
      {
        $lookup: {
          from: "friends",
          localField: "_id",
          foreignField: "userId",
          as: "friends",
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "faveArtists.artistId",
          foreignField: "_id",
          as: "faveArtists.artist",
        },
      },
      {
        $addFields: {
          following: { $size: "$following" },
          friendsCount: { $size: "$friends" },
          artistPlayed: { $size: "$friends" },
        },
      },
      {
        $group: {
          _id: "$_id",
          faveArtist: { $push: "$faveArtists" },
          otherFields: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$otherFields", { faveArtists: "$faveArtist" }],
          },
        },
      },
      {
        $project: {
          friends: 0,
          password: 0, // Remove password from response for security
        },
      },
    ]);

    if (!user || user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const artistPlayed = await LastPlayed.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$userId", user[0]._id],
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
    ]);

    let uniqueArtists = [];
    let uniqueTracks = [];
    artistPlayed.forEach((val) => {
      if (!uniqueArtists.includes(val.track.artistId.toString())) {
        uniqueArtists.push(val.track.artistId.toString());
        uniqueTracks.push(val.track);
      }
    });

    return res.status(200).json({
      message: "Successfully retrieved user",
      data: { ...user[0], artistPlayed: uniqueTracks.length },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching user by email",
      error: error.message,
    });
  }
};

const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.aggregate([
      {
        $match: { email: email },
      },
      {
        $lookup: {
          from: "preferences",
          localField: "_id",
          foreignField: "userId",
          as: "preferences",
        },
      },
      {
        $lookup: {
          from: "faveartists",
          localField: "_id",
          foreignField: "userId",
          as: "faveArtists",
        },
      },
      {
        $unwind: {
          path: "$faveArtists",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "follower",
          as: "following",
        },
      },
      {
        $lookup: {
          from: "friends",
          localField: "_id",
          foreignField: "userId",
          as: "friends",
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "faveArtists.artistId",
          foreignField: "_id",
          as: "faveArtists.artist",
        },
      },
      {
        $addFields: {
          following: { $size: "$following" },
          friendsCount: { $size: "$friends" },
          artistPlayed: { $size: "$friends" },
        },
      },
      {
        $group: {
          _id: "$_id",
          faveArtist: { $push: "$faveArtists" },
          otherFields: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$otherFields", { faveArtists: "$faveArtist" }],
          },
        },
      },
    ]);

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const isArtist = await Artist.findOne({ userId: user[0]._id });

    const isPasswordValid = await bcrypt.compare(password, user[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid password",
      });
    }

    const artistPlayed = await LastPlayed.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$userId", user[0]._id],
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
    ]);

    let uniqueArtists = [];
    let uniqueTracks = [];
    artistPlayed.forEach((val) => {
      if (!uniqueArtists.includes(val.track.artistId.toString())) {
        uniqueArtists.push(val.track.artistId.toString());
        uniqueTracks.push(val.track);
      }
    });

    const userData = {
      ...user[0],
      artist: isArtist === null ? null : isArtist?.id,
      artistPlayed: uniqueTracks.length,
    };
    delete userData.password;

    return res.status(200).json({
      status: "success",
      message: "Sign in successful",
      data: {
        ...userData,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error signing in",
      error: error.message,
    });
  }
};

export {
  getAllUsers,
  getUser,
  getArtistUserSubcribeTo,
  createUser,
  createGenresForUser,
  getArtistBasedOnUserGenre,
  createUserFaveArtistBasedOnGenres,
  subcribeToPremium,
  subcribeToArtist,
  isArtistFave,
  isUserFollowing,
  addToFavorite,
  deleteUser,
  addFriend,
  getUserFriends,
  getUserByEmail,
  signIn,
  checkIfUserNameExist,
};
