const express = require("express");
const {
  searchAll,
  getRecentSearches,
  clearRecentSearches,
  getTrendingSearches,
  searchByCategory
} = require("../controller/search.controller");
const searchRoutes = express.Router();

// Main search routes
searchRoutes.get("/", searchAll);
searchRoutes.get("/category", searchByCategory);

// Recent searches (requires authentication)
searchRoutes.get("/recent",  getRecentSearches);
searchRoutes.delete("/recent", clearRecentSearches);

// Trending searches
searchRoutes.get("/trending", getTrendingSearches);

module.exports = searchRoutes;
