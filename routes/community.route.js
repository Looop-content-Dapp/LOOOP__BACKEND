import { Router } from "express";
import {
  getAllCommunity,
  getCommunityByArtistId,
  joinCommunity,
  createCommunity,
  searchCommunity,
  deleteCommunity,
  getArtistCommunitiesByGenre,
  getTrendingArtistsByGenre,
  checkIfTokenSymbolExist,
} from "../controller/community.controller.js";

const communityRouter = Router();

// Basic community routes
communityRouter.get("/search", searchCommunity);
communityRouter.get("/", getAllCommunity);
communityRouter.get("/:artistid", getCommunityByArtistId);

// Community management routes
communityRouter.patch("/collectible-check/:symbol", checkIfTokenSymbolExist);
communityRouter.post("/createcommunity", createCommunity);
communityRouter.post("/joincommunity", joinCommunity);
communityRouter.delete("/deletecommunity/:communityId", deleteCommunity);

// New genre-based recommendation routes
communityRouter.get("/artists-by-genre/:userId", getArtistCommunitiesByGenre);
communityRouter.get("/trending-artists/:userId", getTrendingArtistsByGenre);

export default communityRouter;
