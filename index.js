const mongoose = require("mongoose");
const userrouter = require("./routes/user.route");
const artistrouter = require("./routes/artist.route");
const preferenceRouter = require("./routes/preferences.route");
const faveArtistRouter = require("./routes/faveartist.mode");
const songRouter = require("./routes/songs.route");
const communityRouter = require("./routes/community.route");
const genreRoute = require("./routes/genres.route");
const playlistRouter = require("./routes/playlist.route");

require("dotenv").config();
const express = require("express"),
  app = express(),
  cors = require("cors");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());

app.use((req, res, next) => {
  console.log(req.path, req.method);
  next();
});

app.get("/", (req, res) => {
  return res.send("welcome to the official looop Api");
});

// routes
app.use("/api/user", userrouter);
app.use("/api/artist", artistrouter);
app.use("/api/preference", preferenceRouter);
app.use("/api/faveartist", faveArtistRouter);
app.use("/api/song", songRouter);
app.use("/api/community", communityRouter);
app.use("/api/genre", genreRoute);
app.use("/api/playlist", playlistRouter);

const port = process.env.NODE_ENV === "production" ? process.env.PORT : 8000;

mongoose.connect(
  "mongodb+srv://Looopmobiledapp:LooopDev@looopcluster0.ptr07.mongodb.net/"
);

mongoose.connection.on("open", () => {
  app.listen(port, "0.0.0.0", () => {
    console.log("Loop backend running on:", port);
  });
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
  process.exit(1);
});
