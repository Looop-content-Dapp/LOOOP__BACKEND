
import mongoose from "mongoose";
import cors from "cors";
import express, { urlencoded, json } from "express";

import userRouter from "./routes/user.route";
import artistRouter from "./routes/artist.route";
import artistClaimRouter from "./routes/artistClaim.route";
import preferenceRouter from "./routes/preferences.route";
import faveArtistRouter from "./routes/faveartist.mode";
import songRouter from "./routes/songs.route";
import communityRouter from "./routes/community.route";
import genreRoute from "./routes/genres.route";
import playlistRouter from "./routes/playlist.route";
import postRouter from "./routes/post.route";
import searchRoutes from "./routes/search.routes";

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
