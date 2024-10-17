const express = require("express");
const {} = require("../controller/genre.controller");
const {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSong,
  createPlaylist,
  deletePlayList,
  addSongToPlaylist,
  pinnPlaylist,
} = require("../controller/playlistsong.controller");
const isvaliduser = require("../middlewares/isvaliduser.middleware");

const playlistRouter = express.Router();

playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/getallplaylistforuser/:userId", getAllPlayListForUser);
playlistRouter.get("/getplaylistsong/:playlistId", getPlayListSong);

playlistRouter.post("/createplaylist", isvaliduser, createPlaylist);
playlistRouter.post("/addsongtoplaylist", addSongToPlaylist);

playlistRouter.put("/pin/:playlistId", pinnPlaylist);

playlistRouter.delete("/deleteplaylist", deletePlayList);

module.exports = playlistRouter;
