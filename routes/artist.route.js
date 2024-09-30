const express = require("express");
const {
  getAllArtists,
  getArtist,
  createArtist,
  getArtistSubcribers,
  followArtist,
  getFollow,
} = require("../controller/artist.controller");
const artistrouter = express.Router();

artistrouter.get("/", getAllArtists);
artistrouter.get("/:id", getArtist);
artistrouter.get("/getartistsubcribers/:artistId", getArtistSubcribers);
artistrouter.get("/follow/:id", getFollow);

artistrouter.post("/follow/:userId/:artistId", followArtist);
artistrouter.post("/createartist", createArtist);

// router.delete("/:id", deleteUsergetAllUsers);

module.exports = artistrouter;
