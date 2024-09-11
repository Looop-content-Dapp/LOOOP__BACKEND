const Genre = require("../models/genre.model");

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
  deleteGenre,
  createAGenre,
};
