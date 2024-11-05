const express = require("express");
const {
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
} = require("../controller/song.controller");

const songRouter = express.Router();

// Basic Song Operations
songRouter.get("/", getAllSongs);
songRouter.get("/:songId", getSong);
// songRouter.patch("/edit-song", editSongFile);

// Search and Discovery
// songRouter.get("/discover/genre/:userId", getReleaseBasedOnGenres);
// songRouter.get("/discover/following/:userId", getSongOfArtistTheyFollow);

// Release Management
songRouter.get("/releases/all", getAllReleases);
songRouter.get("/releases/:releaseId", getRelease);
// songRouter.get("/releases/artist/:artistId", getReleaseByArtist);
songRouter.post("/releases/create", createRelease);
// songRouter.post("/releases/add-track", addRelease);
// songRouter.delete("/releases/:releaseId", deleteRlease);
songRouter.get("/releases/:releaseId/tracks", getTracksFromRelease);
// songRouter.delete("/releases/tracks/:songId/:trackId", deleteASongFromARelease);

// Artist-specific Routes
songRouter.get("/artist/:artistId/top-songs", getTopSongsForArtist);
songRouter.get("/artist/:artistId/albums-eps", getAlbumsAndEpByArtist);
songRouter.get("/artist/:artistId/singles", getSingles);
// songRouter.get("/artist/:artistId/features", getSongArtistFeaturedOn);

// User Interactions & Library
songRouter.post("/stream/:songId/:userId", streamSong);
// songRouter.get("/history/:userId", getSongLastPlayed);
// songRouter.get("/library/albums/:userId", getLikedAlbum);
// songRouter.get("/library/tracks/:userId", getLikeSong);
// songRouter.post("/library/albums/:userId/:releaseId", saveAlbum);
// songRouter.post("/library/tracks/:userId/:trackId", likeSong);

// New Enhanced Routes
// Song Analytics
songRouter.get("/analytics/:songId/engagement", getSongEngagementMetrics);

// User Library Management
songRouter.post("/library/save/:userId/:releaseId", toggleSavedRelease);
songRouter.get("/library/saved/:userId", getSavedReleases);

// User Insights and History
songRouter.get("/insights/top-songs/:userId", getUserTopSongs);
songRouter.get("/insights/history/:userId", getUserListeningHistory);
songRouter.get("/insights/stats/:userId", getUserListeningInsights);

module.exports = songRouter;
