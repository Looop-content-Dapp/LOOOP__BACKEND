const express = require("express");
const {
  getAllCommunity,
  getCommunity,
  joinCommunity,
  createCommunity,
  searchCommunity,
  deleteCommunity,
  getArtistCommunitiesByGenre,
  getTrendingArtistsByGenre
} = require("../controller/community.controller");

const communityRouter = express.Router();

// Basic community routes
communityRouter.get("/search", searchCommunity);
communityRouter.get("/", getAllCommunity);
communityRouter.get("/:communityid", getCommunity);

// Community management routes
communityRouter.post("/createcommunity", createCommunity);
communityRouter.post("/joincommunity", joinCommunity);
communityRouter.delete("/deletecommunity/:communityId", deleteCommunity);

// New genre-based recommendation routes
communityRouter.get("/artists-by-genre/:userId", getArtistCommunitiesByGenre);
communityRouter.get("/trending-artists/:userId", getTrendingArtistsByGenre);

module.exports = communityRouter;
