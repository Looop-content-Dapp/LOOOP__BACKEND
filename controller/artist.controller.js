const bcrypt = require("bcryptjs");
const Artist = require("../models/artist.model");
const Social = require("../models/socials.model");

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
      name,
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
      name,
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

module.exports = {
  getAllArtists,
  getArtist,
  createArtist,
};
