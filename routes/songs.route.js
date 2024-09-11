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
  getReleaseBasedOnGenres,
} = require("../controller/song.controller");

const songRouter = express.Router();

songRouter.get("/getallreleases", getAllReleases);
songRouter.get("/", getAllSongs);
songRouter.get("/:songId", getSong);
songRouter.get("/getrelease/:releaseId", getRelease);
songRouter.get("/getreleasebasedongenres/:userId", getReleaseBasedOnGenres);

songRouter.post("/createsong", createRelease);
songRouter.post("/addRelease", addRelease);

songRouter.delete(
  "/deleteasongfromarelease/:songId/:trackId",
  deleteASongFromARelease
);
// songRouter.delete("/:id", deleteUsergetAllUsers);

module.exports = songRouter;
