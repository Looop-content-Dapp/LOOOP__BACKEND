const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Preferences = require("../models/Preferences");
const FaveArtist = require("../models/faveArtist");
const Genre = require("../models/genre.model");
const Artist = require("../models/artist.model");
const Subscriber = require("../models/subcriber.model");

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
          from: "artists",
          localField: "faveArtists.artistId",
          foreignField: "_id",
          as: "faveArtists.artist",
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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      message: "successfully gotten a user",
      data: user[0],
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

    if (password == "" || email == "") {
      return res
        .status(401)
        .json({ message: "Password and Email is required" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      password: hashedPassword,
    });

    await user.save();

    return res.status(200).json({
      message: "successfully created a user",
      data: user,
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

    const user = await User.findById("66f986757aa20c4c3629ab69");

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
                $toObjectId: "66f986757aa20c4c3629ab69",
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

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

    const alreadySubcribed = await Subscriber.findOne({
      userId: userId,
      artistId: artistId,
    });

    if (alreadySubcribed) {
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
        alreadySubcribed ? "unsubcribed" : "subcribed"
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
};

// "preferences": ["rock", "pop", "classical"],
// "faveArtist": ["66d98b422581893979ed2ae5", "66d98c18abb0baa9d564204b"]
