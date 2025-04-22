import { Router } from "express";
import {
//   addTrackToFavorites,
//   addReleaseToFavorites,
  getFavoriteTracks,
  getFavoriteReleases,
  removeTrackFromFavorites,
  removeReleaseFromFavorites
} from "../controller/favorites.controller.js";

const favoritesRouter = Router();

// Add items to favorites
// favoritesRouter.post("/tracks", addTrackToFavorites);
// favoritesRouter.post("/releases", addReleaseToFavorites);

// Get favorite items
favoritesRouter.get("/tracks/:userId", getFavoriteTracks);
favoritesRouter.get("/releases/:userId", getFavoriteReleases);

// Remove items from favorites
favoritesRouter.delete("/tracks/:userId/:trackId", removeTrackFromFavorites);
favoritesRouter.delete("/releases/:userId/:releaseId", removeReleaseFromFavorites);

export default favoritesRouter;
