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
  getTop100Songs,
  getAlbumsAndEpByArtist,
  getSingles,
  getSongArtistFeaturedOn,
  getTopSongsForArtist,
  streamSong,
} = require("../controller/song.controller");

const songRouter = express.Router();

songRouter.get("/gettopp100songs", getTop100Songs);
songRouter.get("/gettopsongforartist/:artistId", getTopSongsForArtist);
songRouter.get("/getalbumsandepbyartist/:artistId", getAlbumsAndEpByArtist);
songRouter.get("/getsingles/:artistId", getSingles);
songRouter.get("/getsongartistfeaturedon/:artistId", getSongArtistFeaturedOn);

songRouter.get("/getallreleases", getAllReleases);
songRouter.get("/", getAllSongs);
songRouter.get("/:songId", getSong);
songRouter.get("/getrelease/:releaseId", getRelease);
songRouter.get("/getreleasebasedongenres/:userId", getReleaseBasedOnGenres);

songRouter.post("/createsong", createRelease);
songRouter.post("/addRelease", addRelease);
songRouter.post("/streamsong/:songId", streamSong);

songRouter.delete(
  "/deleteasongfromarelease/:songId/:trackId",
  deleteASongFromARelease
);
// songRouter.delete("/:id", deleteUsergetAllUsers);

module.exports = songRouter;
