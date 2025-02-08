import mongoose from "mongoose";
import cors from "cors";
import express, { urlencoded, json } from "express";
import { config } from "dotenv";

import userRouter from "./routes/user.route.js";
import artistRouter from "./routes/artist.route.js";
import artistClaimRouter from "./routes/artistClaim.route.js";
import preferenceRouter from "./routes/preferences.route.js";
// import faveArtistRouter from "./routes/faveArtist.route.js";
import songRouter from "./routes/songs.route.js";
import communityRouter from "./routes/community.route.js";
import genreRoute from "./routes/genres.route.js";
import playlistRouter from "./routes/playlist.route.js";
import postRouter from "./routes/post.route.js";
import searchRoutes from "./routes/search.routes.js";
// import OAuthRouter from "./routes/oauth.route.js";
import adminRouter from "./routes/admin-route/admin.route.js";
import contractHelper from "./xion/contractConfig.js";
import paymentRouter from "./routes/payment.route.js";

config();

const app = express();

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => res.send("Welcome to the official Looop API!"));
app.get("/api", (req, res) => res.send("Welcome to the official Looop API!"));

app.use("/api/user", userRouter);
app.use("/api/artist", artistRouter);
app.use("/api/preference", preferenceRouter);
// app.use("/api/faveartist", faveArtistRouter);
app.use("/api/song", songRouter);
app.use("/api/community", communityRouter);
app.use("/api/genre", genreRoute);
app.use("/api/playlist", playlistRouter);
app.use("/api/post", postRouter);
app.use("/api/artistclaim", artistClaimRouter);
app.use("/api/search", searchRoutes);
app.use("/api/admin", adminRouter);
// app.use("/api/payment", paymentRouter);
// app.use("/api/oauth", OAuthRouter);

const PORT = process.env.NODE_ENV === "production" ? process.env.PORT : 8000;
const mongoURI =
  // process.env.NODE_ENV !== "production"
  //   ? "mongodb://localhost:27017/"
  //   : process.env.MONGODB_URI ||
      "mongodb+srv://looopMusic:Dailyblessing@looopmusic.a5lp1.mongodb.net/?retryWrites=true&w=majority&appName=LooopMusic";

(async () => {
  try {
    console.log("Initializing admin wallet...");
    await contractHelper.initializeAdminWallet();
    console.log("Admin wallet successfully initialized.");

    mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    mongoose.connection.on("open", () => {
      console.log("Connected to MongoDB successfully.");
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    });

    mongoose.connection.on("error", (err) => {
      console.error(`MongoDB connection error: ${err}`);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to initialize admin wallet or MongoDB:", error);
    process.exit(1);
  }
})();
