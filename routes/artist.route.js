const express = require("express");
const {
  getAllArtists,
  getArtist,
  createArtist,
  getArtistSubcribers,
  followArtist,
  getFollow,
  getArtistPost,
} = require("../controller/artist.controller");
const {
  getArtistBasedOnUserGenreExcludingWhoTheyFollow,
} = require("../controller/song.controller");
const artistrouter = express.Router();

artistrouter.get("/", getAllArtists);
artistrouter.get("/:id", getArtist);
artistrouter.get("/getartistsubcribers/:artistId", getArtistSubcribers);
artistrouter.get("/follow/:id", getFollow);
artistrouter.get(
  "/usergenres/:userId",
  getArtistBasedOnUserGenreExcludingWhoTheyFollow
);
artistrouter.get("/artistpost/:artistId", getArtistPost);

artistrouter.post("/follow/:userId/:artistId", followArtist);
artistrouter.post("/createartist", createArtist);

// router.delete("/:id", deleteUsergetAllUsers);

module.exports = artistrouter;
