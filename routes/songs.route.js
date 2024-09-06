const express = require("express");
const {
  getAllSongs,
  getSong,
  createSong,
  createRelease,
  addRelease,
  getAllReleases,
  getRelease,
  deleteASongFromARelease,
} = require("../controller/song.controller");

const songRouter = express.Router();

songRouter.get("/getallreleases", getAllReleases);
songRouter.get("/getrelease/:releaseId", getRelease);
songRouter.get("/", getAllSongs);
songRouter.get("/:songId", getSong);

songRouter.post("/createsong", createRelease);
songRouter.post("/addRelease", addRelease);

songRouter.delete(
  "/deleteasongfromarelease/:songId/:trackId",
  deleteASongFromARelease
);
// songRouter.delete("/:id", deleteUsergetAllUsers);

module.exports = songRouter;
