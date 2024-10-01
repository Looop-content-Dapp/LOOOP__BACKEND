const express = require("express");
const {
  deleteGenre,
  createAGenre,
  getGenres,
  getUserGenres,
} = require("../controller/genre.controller");

const genreRoute = express.Router();

genreRoute.get("/usergenre/:userId", getUserGenres);
genreRoute.get("/getgenres", getGenres);

genreRoute.post("/creategenre", createAGenre);
genreRoute.delete("/:genreId", deleteGenre);

module.exports = genreRoute;
