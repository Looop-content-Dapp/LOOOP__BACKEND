import { Router } from "express";
import {
  checkIfUserNameExist,
  createUser,
  deleteUser,
  followArtist,
  generateUserFeed,
  getAllUsers,
  getFollowedArtists,
  getUser,
  getUserByEmail,
  getUserWalletBalance,
  isUserFollowing,
  requestPasswordReset,
  resetPassword,
  signIn,
  updateUserProfile,
  verifyEmailOTP,
  verifyOtp,
} from "../controller/user.controller.js";
import { isUser } from "../middlewares/isvaliduser.middleware.js";

const userRouter = Router();

userRouter.get("/isfollowing/:userId/:artistId", isUserFollowing);

userRouter.get("/", getAllUsers);
userRouter.get("/:id", getUser);
userRouter.get("/wallet-balance/:userId", getUserWalletBalance)

userRouter.post("/createuser", createUser);

userRouter.delete("/delete/:userId", deleteUser);
userRouter.get("/email/:email", getUserByEmail);
userRouter.post("/signin", signIn);
userRouter.post("/check", checkIfUserNameExist);
userRouter.post("/verify-email", verifyEmailOTP);
userRouter.post("/verify-otp", verifyOtp);

// Add this new route
userRouter.get("/feed/:userId", isUser, generateUserFeed);

// Follow/Unfollow artist
userRouter.post("/follow/:userId/:artistId", isUser, followArtist);

// Get followed artists
userRouter.get("/following/:userId", isUser, getFollowedArtists);

userRouter.patch("/profile/:userId", updateUserProfile);

// Password reset routes
userRouter.post("/request-password-reset", requestPasswordReset);
userRouter.post("/reset-password", resetPassword);

export default userRouter;
