const bcrypt = require("bcryptjs");
const Artist = require("../models/artist.model");
const Social = require("../models/socials.model");
const Subscriber = require("../models/subcriber.model");
const Follow = require("../models/followers.model");

const getAllArtists = async (req, res) => {
  try {
    const Artists = await Artist.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all Artists",
      data: Artists,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching Artists", error: error.message });
  }
};

const getArtist = async (req, res) => {
  try {
    const artist = await Artist.aggregate([
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
          from: "releases",
          localField: "_id",
          foreignField: "artistId",
          as: "releases",
        },
      },
    ]);

    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    return res.status(200).json({
      message: "successfully get artist",
      data: artist[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching artist", error: error.message });
  }
};

const createArtist = async (req, res) => {
  try {
    const {
      artistname,
      email,
      profileImage,
      password,
      bio,
      genre,
      addinationalInfo,
      twitter,
      linkedin,
      instagram,
    } = req.body;

    if (password == "" || email == "") {
      return res
        .status(401)
        .json({ message: "Password and Email is required" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const artist = new Artist({
      artistname,
      email,
      profileImage,
      password: hashedPassword,
      bio,
      genre,
      addinationalInfo,
      addinationalInfo: addinationalInfo ? addinationalInfo : "",
    });

    const socials = await Social({
      artistId: artist._id,
      twitter,
      linkedin,
      instagram,
    });

    await Promise.all([await artist.save(), await socials.save()]);

    return res.status(200).json({
      message: "successfully created an artist",
      data: artist,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating artist", error: error.message });
  }
};

const getArtistSubcribers = async (req, res) => {
  try {
    const { artistId } = req.params;

    const subcribers = await Subscriber.find({
      artistId: artistId,
    });

    return res.status(200).json({
      message: `successfully gotten data`,
      subcribers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
};

const followArtist = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const alreadySubcribed = await Follow.findOne({
      following: artistId, // get total followers for artist
      follower: userId,
    });

    console.log(alreadySubcribed);

    if (alreadySubcribed) {
      await Subscriber.deleteOne({
        following: artistId, // get total followers for artist
        follower: userId,
      });
    } else {
      const follower = await Follow({
        following: artistId, // get total followers for artist
        follower: userId,
      });
      await follower.save();
    }

    return res.status(200).json({
      message: `successfully ${
        alreadySubcribed ? "unfollowed" : "followed"
      } artist`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

const getFollow = async (req, res) => {
  try {
    const { id } = req.params;

    const isArtist = await Artist.findOne({ _id: id });

    console.log(isArtist);
    let follow;
    if (isArtist) {
      // get artist followers
      follow = await Follow.aggregate([
        {
          $match: {
            $expr: {
              $eq: ["$following", { $toObjectId: id }],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "follower",
            foreignField: "_id",
            as: "follower",
          },
        },
        {
          $unwind: {
            path: "$follower",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            following: 0,
          },
        },
      ]);
    } else {
      // get artist following
      follow = await Follow.aggregate([
        {
          $match: {
            $expr: {
              $eq: ["$follower", { $toObjectId: id }],
            },
          },
        },
        {
          $lookup: {
            from: "artists",
            localField: "following",
            foreignField: "_id",
            as: "artist",
          },
        },
        {
          $unwind: {
            path: "$artist",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            follower: 0,
          },
        },
      ]);
    }

    return res.status(200).json({
      message: `successfully ${
        isArtist ? "gotten artist followers" : "gotten user following"
      } `,
      data: follow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

module.exports = {
  getAllArtists,
  getArtist,
  createArtist,
  getArtistSubcribers,
  followArtist,
  getFollow,
};
