
import mongoose from "mongoose";
import cors from "cors";
import express, { urlencoded, json } from "express";

import userRouter from "./routes/user.route.js";
import artistRouter from "./routes/artist.route.js";
import artistClaimRouter from "./routes/artistClaim.route.js";
import preferenceRouter from "./routes/preferences.route.js";
import faveArtistRouter from "./routes/faveArtist.route.js";
import songRouter from "./routes/songs.route.js";
import communityRouter from "./routes/community.route.js";
import genreRoute from "./routes/genres.route.js";
import playlistRouter from "./routes/playlist.route.js";
import postRouter from "./routes/post.route.js";
import searchRoutes from "./routes/search.routes.js";
import OAuthRouter from "./routes/oauth.route.js";

import { config } from "dotenv";
config(); //Loads .env


const app = express();

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(cors());


app.use((req, res, next) => {
  console.log(req.path, req.method);
  next();
});

app.get("/", (req, res) => {
  return res.send("welcome to the official looop Api");
});

app.get("/api", (req, res) => {
  return res.send("welcome to the official looop Api");
});


// routes
app.use("/api/user", userRouter);
app.use("/api/artist", artistRouter);
app.use("/api/preference", preferenceRouter);
app.use("/api/faveartist", faveArtistRouter);
app.use("/api/song", songRouter);
app.use("/api/community", communityRouter);
app.use("/api/genre", genreRoute);
app.use("/api/playlist", playlistRouter);
app.use("/api/post", postRouter);
app.use("/api/artistclaim", artistClaimRouter)
app.use('/api/search', searchRoutes);
app.use('/api/oauth', OAuthRouter);

const port = process.env.NODE_ENV === "production" ? process.env.PORT : 8000;
const mongoURI = process.env["MONGODB_URI"] || "mongodb+srv://Looopmobiledapp:LooopDev@looopcluster0.ptr07.mongodb.net/"

mongoose.connect(mongoURI);

mongoose.connection.on("open", () => {
  app.listen(port, "0.0.0.0", () => {
    console.log("Loop backend running on:", port);
  });
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
  process.exit(1);
});
