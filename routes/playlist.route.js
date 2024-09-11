const express = require("express");
const {} = require("../controller/genre.controller");
const {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSong,
  createPlaylist,
  deletePlayList,
  addSongToPlaylist,
} = require("../controller/playlistsong.controller");

const playlistRouter = express.Router();

playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/getallplaylistforuser/:userId", getAllPlayListForUser);
playlistRouter.get("/getplaylistsong/:playlistId", getPlayListSong);

playlistRouter.post("/createplaylist", createPlaylist);
playlistRouter.post("/addsongtoplaylist", addSongToPlaylist);
playlistRouter.delete("/deleteplaylist", deletePlayList);

module.exports = playlistRouter;
