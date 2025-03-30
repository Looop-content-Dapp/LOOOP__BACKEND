import { createServer } from "http";
import mongoose from "mongoose";
import cors from "cors";
import express, { urlencoded, json } from "express";
import { config } from "dotenv";
import { websocketService } from "./utils/websocket/websocketServer.js";

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
import referralRouter from "./routes/referral.route.js";
import oauthrouter from "./routes/oauth.route.js";
import nftRoutes from "./routes/nft.routes.js";
import xionRoutes from "./routes/xion.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import AbstraxionAuth from "./xion/abstraxionauth.js";

config();

const app = express();
const server = createServer(app);

// Initialize WebSocket
websocketService.initialize(server);

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
app.use("/api/referral", referralRouter);
app.use("/api/nfts", nftRoutes);
// app.use("/api/payment", paymentRouter);
app.use("/api/oauth", oauthrouter);

// Register Xion routes
app.use("/api/xion", xionRoutes);
app.use("/api/notifications", notificationRoutes);

const PORT = 9001;
const mongoURI =
  process.env.MONGODB_URI ||
  "mongodb+srv://looopMusic:Dailyblessing@looopmusic.a5lp1.mongodb.net/?retryWrites=true&w=majority&appName=LooopMusic";

(async () => {
  try {
    AbstraxionAuth.configureAbstraxionInstance(
      process.env.RPC_URL || "https://rpc.xion-testnet-2.burnt.com/",
      process.env.REST_URL || "https://api.xion-testnet-2.burnt.com",
      process.env.TREASURY_ADDRESS
    );

    mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    mongoose.connection.on("open", () => {
      console.log("Connected to MongoDB successfully.");
      server.listen(PORT, () => {
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
