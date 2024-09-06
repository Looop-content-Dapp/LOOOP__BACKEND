const express = require("express");
const {
  getAllArtists,
  getArtist,
  createArtist,
} = require("../controller/artist.controller");
const artistrouter = express.Router();

artistrouter.get("/", getAllArtists);
artistrouter.get("/:id", getArtist);
artistrouter.post("/createartist", createArtist);

// router.delete("/:id", deleteUsergetAllUsers);

module.exports = artistrouter;
