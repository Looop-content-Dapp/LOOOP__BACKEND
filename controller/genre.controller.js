const Genre = require("../models/genre.model");
const Preferences = require("../models/Preferences");
const { matchUser } = require("../utils/helpers/searchquery");

const getGenres = async (req, res) => {
  try {
    const genre = await Genre.find({});

    return res.status(200).json({
      message: "successfully gotten all genres",
      data: genre,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching genres", error: error.message });
  }
};

const getUserGenres = async (req, res) => {
  try {
    const match = matchUser({ id: req.params.userId, name: "userId" });

    console.log(match);
    const genres = await Preferences.aggregate([
      { ...match },
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
      {
        $project: {
          _id: 0,
          genreId: 0,
          userId: 0,
          // genreDescription: "$genre.description",
          // genreImage: "$genre.image",
        },
      },
    ]);

    return res.status(200).json({
      message: "success",
      data: genres,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error occured", error: error.message });
  }
};

const deleteGenre = async (req, res) => {
  try {
    const genre = await Genre.findByIdAndDelete(req.params.genreId);

    return res.status(200).json({
      message: "successfully deleted",
      data: genre,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error deleting genre", error: error.message });
  }
};

const createAGenre = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    const genreExist = await Genre.find({ name: name });

    if (name == "" || description == "" || image == "") {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (genreExist.length > 0) {
      return res.status(409).json({ message: "Genre already exists" });
    }

    const genre = new Genre({
      name,
      description,
      image,
    });

    await genre.save();
    return res.status(200).json({
      message: "successfully created a genre",
      data: genre,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating a genre", error: error.message });
  }
};

module.exports = {
  getGenres,
  getUserGenres,
  deleteGenre,
  createAGenre,
};
