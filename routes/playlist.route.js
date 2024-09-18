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
const isPremiumUser = require("../middlewares/ispremiumuser.middleware");

const playlistRouter = express.Router();

playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/getallplaylistforuser/:userId", getAllPlayListForUser);
playlistRouter.get("/getplaylistsong/:playlistId", getPlayListSong);

playlistRouter.post("/createplaylist", isPremiumUser, createPlaylist);
playlistRouter.post("/addsongtoplaylist", isPremiumUser, addSongToPlaylist);
playlistRouter.delete("/deleteplaylist", isPremiumUser, deletePlayList);

module.exports = playlistRouter;
