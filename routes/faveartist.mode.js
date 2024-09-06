const express = require("express");
const {
  getAllFaveArtist,
  getFaveArtist,
  getAllFaveArtistForUser,
} = require("../controller/faveartist.controller");

const faveArtistRouter = express.Router();

faveArtistRouter.get("/", getAllFaveArtist);
faveArtistRouter.get("/:id", getFaveArtist);
faveArtistRouter.get("/getfaveartistforuser/:userid", getAllFaveArtistForUser);

module.exports = faveArtistRouter;
