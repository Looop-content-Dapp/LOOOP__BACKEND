import { Router } from "express";
import {
  getAllPlayList,
  getAllPlayListForUser,
  getPlayListSongs,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  updatePlaylist,
  deletePlayList,
  togglePinPlaylist,
} from "../controller/playlistsong.controller.js";

import { isUser } from "../middlewares/isvaliduser.middleware.js";

const playlistRouter = Router();

// Public routes
playlistRouter.get("/", getAllPlayList);
playlistRouter.get("/user/:userId", getAllPlayListForUser);
playlistRouter.get("/playlist/:playlistId", getPlayListSongs);

// Protected routes
playlistRouter.post("/create", isUser, createPlaylist);
playlistRouter.post("/songs/add", isUser, addSongToPlaylist);
playlistRouter.post("/songs/remove", isUser, removeSongFromPlaylist);

playlistRouter.put("/update/:playlistId", isUser, updatePlaylist);
playlistRouter.put("/pin/:playlistId", isUser, togglePinPlaylist);

playlistRouter.delete("/delete", isUser, deletePlayList);

export default playlistRouter;
