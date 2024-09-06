const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Preferences = require("../models/Preferences");
const FaveArtist = require("../models/faveArtist");

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
    const { email, password, preferences, faveArtist } = req.body;

    console.log(email, password, preferences, faveArtist);
    const parsePeferences = JSON.parse(JSON.stringify(preferences));
    const parseFaveArtist = JSON.parse(JSON.stringify(faveArtist));

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

    for (let i = 0; i < parsePeferences.length; i++) {
      const element = parsePeferences[i];
      const peference = new Preferences({
        peference: element,
        userId: user._id,
      });
      await peference.save();
    }

    for (let i = 0; i < parseFaveArtist.length; i++) {
      const element = parseFaveArtist[i];
      console.log(element);
      const faveArtist = new FaveArtist({
        artistId: element,
        userId: user._id,
      });
      await faveArtist.save();
    }

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

module.exports = {
  getAllUsers,
  getUser,
  createUser,
};
