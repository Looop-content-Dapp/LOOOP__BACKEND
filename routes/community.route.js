import { Router } from "express";
import {
  // getAllCommunity,
  // getCommunity,
  joinCommunity,
  createCommunity,
  searchCommunity,
  deleteCommunity,
  getArtistCommunitiesByGenre,
  getTrendingArtistsByGenre,
} from "../controller/community.controller.js";

const communityRouter = Router();

// Basic community routes
communityRouter.get("/search", searchCommunity);
// communityRouter.get("/", getAllCommunity);
// communityRouter.get("/:communityid", getCommunity);

// Community management routes
communityRouter.post("/createcommunity", createCommunity);
communityRouter.post("/joincommunity", joinCommunity);
communityRouter.delete("/deletecommunity/:communityId", deleteCommunity);

// New genre-based recommendation routes
communityRouter.get("/artists-by-genre/:userId", getArtistCommunitiesByGenre);
communityRouter.get("/trending-artists/:userId", getTrendingArtistsByGenre);

export default communityRouter;
