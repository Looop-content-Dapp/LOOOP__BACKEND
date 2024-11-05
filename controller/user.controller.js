require("dotenv").config();
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Preferences = require("../models/Preferences");
const FaveArtist = require("../models/faveArtist");
const Genre = require("../models/genre.model");
const Artist = require("../models/artist.model");
const Subscriber = require("../models/subcriber.model");
const { Account, RpcProvider, Contract, transaction } = require("starknet");
const looopAbi = require("../Abis/looopAbi.json");
const Follow = require("../models/followers.model");
const Friends = require("../models/friends.model");
const { matchUser } = require("../utils/helpers/searchquery");
const LastPlayed = require("../models/lastplayed.model");
const generateUsername = require("../utils/helpers/generateUsername");

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
    const matchUserObj = matchUser({ id: req.params.id, name: "userId" });

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
        },
      },
    ]);

    const artistPlayed = await LastPlayed.aggregate([
      {
        ...matchUserObj,
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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let arr = [];
    let arr2 = [];
    artistPlayed.forEach((val) => {
      if (!arr.includes(val.track.artistId.toString())) {
        arr.push(val.track.artistId.toString());
        arr2.push(val.track);
      }
    });

    arr.find((val) => val);

    user.artistPlayed = arr2.length;
    return res.status(200).json({
      message: "successfully gotten a user",
      data: { ...user[0], artistPlayed: arr2.length },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const provider = new RpcProvider({ nodeUrl: process.env.PROVIDER });

    const account = new Account(
      provider,
      process.env.ACCT_ADDRESS,
      process.env.PRIVATE_KEY
    );

    const looopContract = new Contract(
      looopAbi,
      process.env.LOOOP_CONTRACT,
      account
    );

    if (password == "" || email == "") {
      return res
        .status(401)
        .json({ message: "Password and Email is required" });
    }

    const username = await generateUsername(email);

    let tx = await looopContract.register_account(
      process.env.NFT_CONTRACT_ADDRESS,
      process.env.NFT_TOKEN_ID,
      process.env.IMPLEMENTATION_HASH,
      username,
      password
    );

    let reciept = await provider.waitForTransaction(tx.transaction_hash);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      username,
      password: hashedPassword,
    });

    await user.save();

    return res.status(200).json({
      message: "successfully created a user",
      data: { user: user, transaction: tx, reciept: reciept },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

const createGenresForUser = async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    const parsePeferences = JSON.parse(JSON.stringify(preferences));

    for (let i = 0; i < parsePeferences.length; i++) {
      const element = parsePeferences[i];
      const peference = new Preferences({
        genreId: element,
        userId: userId,
      });
      await peference.save();
    }

    return res.status(200).json({
      message: "successfully saved all genres for user",
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
      return res.status(404).json({ message: "User not found" });
    }

    const userGenres = await Preferences.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$userId",
              {
                $toObjectId: userId,
              },
            ],
          },
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

    let newArr = [];

    userGenres.forEach((genre) => {
      newArr.push(genre.genre.name);
    });

    const artists = await Artist.find({
      $text: { $search: newArr.join(",") },
    });

    return res.status(200).json({
      message: "successfully gotten a artist based on genres of user",
      data: artists,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching artist based on genre of user",
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
      return res.status(404).json({ message: "User not found" });
    }

    for (let i = 0; i < parseFaveArtist.length; i++) {
      const element = parseFaveArtist[i];
      const faveArtist = new FaveArtist({
        artistId: element,
        userId: userId,
      });
      await faveArtist.save();
    }

    return res.status(200).json({
      message: "successfully saved all users fave artist based on genre",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error saving user fave artist based on genre",
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
          $match: { email: email }
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
              $eq: [
                "$userId",
                user[0]._id
              ],
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
        error: error.message
      });
    }
  };

module.exports = {
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
};

// "preferences": ["rock", "pop", "classical"],
// "faveArtist": ["66d98b422581893979ed2ae5", "66d98c18abb0baa9d564204b"]
