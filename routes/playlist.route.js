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
const isPremiumUser = require("../middlewares/ispremiumuser.middleware");

const playlistRouter = express.Router();

playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/getallplaylistforuser/:userId", getAllPlayListForUser);
playlistRouter.get("/getplaylistsong/:playlistId", getPlayListSong);

playlistRouter.post("/createplaylist", isPremiumUser, createPlaylist);
playlistRouter.post("/addsongtoplaylist", isPremiumUser, addSongToPlaylist);

playlistRouter.put("/pin/:playlistId", pinnPlaylist);

playlistRouter.delete("/deleteplaylist", isPremiumUser, deletePlayList);

module.exports = playlistRouter;
