const express = require("express");
const { searchAll } = require("../controller/search.controller");
const searchRoutes = express.Router();

searchRoutes.get("/", searchAll);

module.exports = searchRoutes;
