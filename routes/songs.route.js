import { Router } from "express";
import {
    getAllSongs,
    getSong,
    createRelease,
    streamSong,
    shareSong,
    addToPlaylist,
    getSongEngagementMetrics,
    toggleSavedRelease,
    getSavedReleases,
    getUserTopSongs,
    getUserListeningHistory,
    getUserListeningInsights,
    getTopSongs,
    getTrendingSongsByRegion,
    updateSongMetadata,
    getTopSongsForArtist,
    getAlbumsAndEpByArtist,
    getSingles,
    getAllReleases,
    getRelease,
    getTracksFromRelease,
    getDashboardRecommendations,
    getSearchSuggestions,
    getFollowedArtistsReleases,
    getDailyMixes,
    getLastPlayed,
    getLocationBasedTracks,
    getWorldwideTopSongs,

} from "../controller/song.controller.js";

const songRouter = Router();

// Basic Song Operations
songRouter.get("/", getAllSongs);
songRouter.get("/:songId", getSong);
songRouter.patch("/metadata/:songId", updateSongMetadata);

// Search and Discovery
songRouter.get("/search/suggestions", getSearchSuggestions);
songRouter.get("/trending/region/:region", getTrendingSongsByRegion);
songRouter.get("/top", getTopSongs);

// Release Management
songRouter.get("/releases/all", getAllReleases);
songRouter.get("/releases/:releaseId", getRelease);
songRouter.post("/releases/create", createRelease);
songRouter.get("/releases/:releaseId/tracks", getTracksFromRelease);

// Artist-specific Routes
songRouter.get("/artist/:artistId/top-songs", getTopSongsForArtist);
songRouter.get("/artist/:artistId/albums-eps", getAlbumsAndEpByArtist);
songRouter.get("/artist/:artistId/singles", getSingles);

// User Interactions & Library
songRouter.post("/stream/:songId/:userId", streamSong);

// Song Analytics
songRouter.get("/analytics/:songId/engagement", getSongEngagementMetrics);

// User Library Management
songRouter.post("/library/save/:userId/:releaseId", toggleSavedRelease);
songRouter.get("/library/saved/:userId", getSavedReleases);

// User Insights and History
songRouter.get("/insights/top-songs/:userId", getUserTopSongs);
songRouter.get("/insights/history/:userId", getUserListeningHistory);
songRouter.get("/insights/stats/:userId", getUserListeningInsights);

// Social Features
songRouter.post("/share/:songId", shareSong);
songRouter.post("/playlist/add/:songId", addToPlaylist);

// Personalized Recommendations
songRouter.get("/recommendations/dashboard/:userId", getDashboardRecommendations);
songRouter.get("/recommendations/followed/:userId", getFollowedArtistsReleases);
songRouter.get("/recommendations/daily-mix/:userId", getDailyMixes);
songRouter.get("/history/last-played/:userId", getLastPlayed);

songRouter.get("/discover/location", getLocationBasedTracks);
songRouter.get("/discover/worldwide", getWorldwideTopSongs);

export default songRouter;
