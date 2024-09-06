const express = require("express");
const {
  getAllPreferences,
  getPreference,
} = require("../controller/peferences.controller");
const preferenceRouter = express.Router();

preferenceRouter.get("/", getAllPreferences);
preferenceRouter.get("/:id", getPreference);

module.exports = preferenceRouter;
