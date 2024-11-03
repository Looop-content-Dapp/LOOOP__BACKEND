const express = require("express");
const {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSongs,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  updatePlaylist,
  deletePlayList,
  togglePinPlaylist,
} = require("../controller/playlistsong.controller");
const isvaliduser = require("../middlewares/isvaliduser.middleware");

const playlistRouter = express.Router();

// Public routes
playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/user/:userId", getAllPlayListForUser);
playlistRouter.get("/playlist/:playlistId", getPlayListSongs);

// Protected routes
playlistRouter.post("/create", isvaliduser, createPlaylist);
playlistRouter.post("/songs/add", isvaliduser, addSongToPlaylist);
playlistRouter.post("/songs/remove", isvaliduser, removeSongFromPlaylist);

playlistRouter.put("/update/:playlistId", isvaliduser, updatePlaylist);
playlistRouter.put("/pin/:playlistId", isvaliduser, togglePinPlaylist);

playlistRouter.delete("/delete", isvaliduser, deletePlayList);

module.exports = playlistRouter;
