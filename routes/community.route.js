const express = require("express");
const {
  getAllCommunity,
  getCommunity,
  joinCommunity,
  createCommunity,
  searchCommunity,
  deleteCommunity
} = require("../controller/community.controller");
const { createArtist } = require("../controller/artist.controller");

const communityRouter = express.Router();

communityRouter.get("/search", searchCommunity);
communityRouter.get("/", getAllCommunity);
communityRouter.get("/:communityid", getCommunity);

communityRouter.post("/createcommunity", createCommunity);
communityRouter.post("/joincommunity", joinCommunity);
communityRouter.delete("/:communityId", deleteCommunity);
// router.delete("/:id", deleteUsergetAllUsers);

module.exports = communityRouter;
