const express = require("express");
const {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSongs,
  createPlaylist,
  updatePlaylist,
  deletePlayList,
  addSongToPlaylist,
  togglePinPlaylist,
} = require("../controller/playlistsong.controller");
const isvaliduser = require("../middlewares/isvaliduser.middleware");

const playlistRouter = express.Router();

// Get routes
playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/user/:userId", getAllPlayListForUser);
playlistRouter.get("/playlist/:playlistId", getPlayListSongs);

// Post routes
playlistRouter.post("/create", isvaliduser, createPlaylist);
playlistRouter.post("/songs/add", isvaliduser, addSongToPlaylist);

// Put routes
playlistRouter.put("/update/:playlistId", isvaliduser, updatePlaylist);
playlistRouter.put("/pin/:playlistId", isvaliduser, togglePinPlaylist);

// Delete routes
playlistRouter.delete("/delete", isvaliduser, deletePlayList);

module.exports = playlistRouter;
