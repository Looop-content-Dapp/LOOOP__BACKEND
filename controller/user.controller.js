import { Types } from "mongoose";
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

import { Genre } from "../models/genre.model.js";
import { Community } from "../models/community.model.js";
import { ArtistClaim } from "../models/artistClaim.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import contractHelper from "../xion/contractConfig.js";
import sendEmail from "../script.cjs";
import { generateOtp } from "../utils/helpers/generateotp.js";
// Loads .env
config();

const otpStore = {};

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

    const isArtist = await Artist.findOne({
      userId: user[0]._id,
      verified: true,
    });

    const hasClaim = await ArtistClaim.findOne({
      userId: user[0]._id,
    });

    const getUserTribe = await CommunityMember.aggregate([
      {
        $match: {
          userId: user[0]._id,
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
        $unwind: "$community",
      },
      {
        $project: {
          _id: "$community._id",
          communityName: "$community.communityName",
          NFTToken: "$community.NFTToken",
          createdBy: "$community.createdBy",
          memberCount: "$community.memberCount",
          coverImage: "$community.coverImage",
        },
      },
    ]);

    const balance = await contractHelper.getBalance(
      "xion15ta5m0qflt9g8ned53pfw8mdg0uuwvsd8m9trp"
    );
    console.log(balance, "balance");

    const userData = {
      ...user[0],
      artist: isArtist === null ? null : isArtist?.id,
      artistClaim: hasClaim === null ? null : hasClaim?.id,
      favouriteArtists: uniqueFavorites,
      communities: getUserTribe,
    };
    delete userData.password;

    return res.status(200).json({
      status: "success",
      message: "User data fetched successfully",
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

const verifyEmailOTP = async (req, res) => {
  const { email } = req.body;
  const otp = generateOtp();
  otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  const existingEmailUser = await User.findOne({ email });
  if (existingEmailUser) {
    return res
      .status(400)
      .json({ status: "failed", message: "Email already in use" });
  } else
    await sendEmail(email, "Verify your signup email!", "verify", {
      email: email,
      otp: otp,
    });

  return res.status(200).json({
    status: "success",
    message: "Check your email",
    data: { otp },
  });
};

const createUser = async (req, res) => {
  try {
    const { email, password, username, fullname, age, gender } = req.body;

    if (
      password == "" ||
      email == "" ||
      username == "" ||
      fullname == "" ||
      age == ""
    ) {
      return res.status(400).json({
        status: "failed",
        message: "Password, Email, Age, Fullname and Username are required",
      });
    }

    if (!["male", "female"].includes(gender)) {
      return res.status(400).json({
        status: "failed",
        message: "Gender must be either 'male' or 'female'",
      });
    }

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res
        .status(400)
        .json({ status: "failed", message: "Email already in use" });
    }

    const existingUsernameUser = await User.findOne({ username });
    if (existingUsernameUser) {
      return res
        .status(400)
        .json({ status: "failed", message: "Username already in use" });
    }

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
        fullname,
        age,
        gender,
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
        message: "Successfully created a user",
        data: { user: userWithoutPassword },
      });
    }
  } catch (error) {
    console.log(error, "error");
    return res.status(500).json({
      status: "failed",
      message: "Error creating user",
      error: error.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email]) {
    return res
      .status(400)
      .json({ status: "failed", message: "OTP not found or expired" });
  }

  if (otpStore[email].otp !== otp) {
    return res.status(400).json({ status: "failed", message: "Invalid OTP" });
  }

  const currentTime = Date.now();
  if (currentTime > otpStore[email].expiresAt) {
    delete otpStore[email];
    return res
      .status(400)
      .json({ status: "failed", message: "OTP has expired" });
  }

  delete otpStore[email];
  return res
    .status(200)
    .json({ status: "success", message: "OTP verified successfully" });
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

    const user = await User.find({
      email: email,
    });

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const isArtist = await Artist.findOne({
      userId: user[0]._id,
      verified: true,
    });

    const hasClaim = await ArtistClaim.findOne({
      userId: user[0]._id,
    });

    const isPasswordValid = await bcrypt.compare(password, user[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid password",
      });
    }

    const userData = {
      ...user[0]._doc,
      artist: isArtist === null ? null : isArtist?.id,
      artistClaim: hasClaim === null ? null : hasClaim?.id,
    };
    delete userData.password;

    const emailResult = await sendEmail(
      user[0].email,
      "New Login Detected",
      "login",
      {
        username: user[0].username,
        loginTime: new Date().toLocaleString(),
        deviceInfo: req.headers["user-agent"],
        ipAddress: req.ip,
      }
    );

    console.log(emailResult);

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
  verifyEmailOTP,
  verifyOtp,
};
