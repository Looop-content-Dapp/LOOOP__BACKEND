import { Router } from "express";
import {
  searchAll,
  getRecentSearches,
  clearRecentSearches,
  getTrendingSearches,
  searchByCategory
} from "../controller/search.controller";

const searchRoutes = Router();

// Main search routes
searchRoutes.get("/", searchAll);
searchRoutes.get("/category", searchByCategory);

// Recent searches (requires authentication)
searchRoutes.get("/recent", getRecentSearches);
searchRoutes.delete("/recent", clearRecentSearches);

// Trending searches
searchRoutes.get("/trending", getTrendingSearches);

export default searchRoutes;
