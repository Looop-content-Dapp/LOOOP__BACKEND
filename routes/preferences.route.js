const express = require("express");
const {
  getAllPreferences,
  getPreference,
  getUserPeferences,
} = require("../controller/peferences.controller");
const preferenceRouter = express.Router();

preferenceRouter.get("/", getAllPreferences);
preferenceRouter.get("/:id", getPreference);
preferenceRouter.get("/user/:id", getUserPeferences);

module.exports = preferenceRouter;
