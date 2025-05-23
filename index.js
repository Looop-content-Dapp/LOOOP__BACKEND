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
import songRouter from "./routes/songs.route.js";
import communityRouter from "./routes/community.route.js";
import genreRoute from "./routes/genres.route.js";
import playlistRouter from "./routes/playlist.route.js";
import postRouter from "./routes/post.route.js";
import searchRoutes from "./routes/search.routes.js";
import adminRouter from "./routes/admin-route/admin.route.js";
import referralRouter from "./routes/referral.route.js";
import oauthrouter from "./routes/oauth.route.js";
import nftRoutes from "./routes/nft.routes.js";
import xionRoutes from './routes/xion.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import AbstraxionAuth from './xion/AbstraxionAuth.js';
import transactionrouter from "./routes/transaction.routes.js";
import passSubscriptionRoute from "./routes/passSubscription.routes.js";
import favoritesRouter from "./routes/favorites.route.js";
import subscriptionRouter from './routes/subscription.routes.js';


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

app.use("/api/user", userRouter);
app.use("/api/artist", artistRouter);
app.use("/api/preference", preferenceRouter);
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
app.use("/api/oauth", oauthrouter);
app.use("/api/transactions", transactionrouter);
app.use("/api/favorites", favoritesRouter);

// Register Xion routes
app.use("/api/xion", xionRoutes);
app.use("/api/notifications", notificationRoutes);

// Register pass subscription routes
app.use('/api/pass-subscriptions', passSubscriptionRoute);

// Register subscription routes
app.use("/api/subscriptions", subscriptionRouter);

// Update PORT definition to use environment variable
const PORT = process.env.PORT || 3000;
const mongoURI =
  process.env.MONGODB_URI ||
  "mongodb+srv://looopMusic:Dailyblessing@looopmusic.a5lp1.mongodb.net/?retryWrites=true&w=majority&appName=LooopMusic";

(async () => {
  try {
    // Remove the event listeners and simplify connection logic
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully.");

    // Start server after successful MongoDB connection
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

    // Initialize Xion after server starts
    try {
      await AbstraxionAuth.configureAbstraxionInstance(
        process.env.RPC_URL || "https://rpc.xion-testnet-2.burnt.com/",
        process.env.REST_URL || "https://api.xion-testnet-2.burnt.com",
        process.env.TREASURY_ADDRESS
      );
      console.log("Xion connection initialized successfully");
    } catch (xionError) {
      console.warn("Warning: Failed to initialize Xion connection:", xionError.message);
      console.warn("The server will continue running, but Xion features may be unavailable");
    }

  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
})();
