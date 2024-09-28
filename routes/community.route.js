const express = require("express");
const {
  getAllCommunity,
  getCommunity,
  joinCommunity,
  createCommunity,
  searchCommunity,
} = require("../controller/community.controller");
const { createArtist } = require("../controller/artist.controller");

const communityRouter = express.Router();

communityRouter.get("/", getAllCommunity);
communityRouter.get("/:communityid", getCommunity);
communityRouter.get("/search", searchCommunity);

communityRouter.post("/createcommunity", createCommunity);
communityRouter.post("/joincommunity", joinCommunity);
// router.delete("/:id", deleteUsergetAllUsers);

module.exports = communityRouter;
