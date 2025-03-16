import { Router } from "express";
import {
  getAllUsers,
  getUser,
  createUser,
  getArtistBasedOnUserGenre,
  createGenresForUser,
  createUserFaveArtistBasedOnGenres,
  subcribeToArtist,
  subcribeToPremium,
  getArtistUserSubcribeTo,
  isArtistFave,
  isUserFollowing,
  addToFavorite,
  deleteUser,
  addFriend,
  getUserFriends,
  getUserByEmail,
  signIn,
  checkIfUserNameExist,
  verifyEmailOTP,
  verifyOtp,
  generateUserFeed,
  followArtist,
  getFollowedArtists,
  addToLibrary,
  getUserLibrary,
  getUserWalletBalance,
} from "../controller/user.controller.js";
import { isUser } from "../middlewares/isvaliduser.middleware.js";

const userRouter = Router();

userRouter.get("/isfave/:userId/:artistId", isArtistFave);
userRouter.get("/isfollowing/:userId/:artistId", isUserFollowing);

userRouter.get("/", getAllUsers);
userRouter.get("/friend/:userId", isUser, getUserFriends);
userRouter.get("/getartistbasedonusergenre/:userId", getArtistBasedOnUserGenre);
userRouter.get("/:id", getUser);
userRouter.get("/getartistusersubcribedto/:userId", getArtistUserSubcribeTo);

userRouter.post("/createuser", createUser);
userRouter.post("/friend/:userId/:friendId", isUser, addFriend);
userRouter.post("/creategenresforuser", createGenresForUser);
userRouter.post(
  "/createuserfaveartistbasedongenres",
  createUserFaveArtistBasedOnGenres
);
userRouter.post("/subcribetoartist/:userId/:artistId", subcribeToArtist);
userRouter.post("/addfave/:userId/:artistId", addToFavorite);

userRouter.put("/changepremiumstate/:userId", subcribeToPremium);

userRouter.delete("/:userId", deleteUser);
userRouter.get("/email/:email", getUserByEmail);
userRouter.post("/signin", signIn);
userRouter.post("/check", checkIfUserNameExist);
userRouter.post("/verify-email", verifyEmailOTP);
userRouter.post("/verify-otp", verifyOtp);

// Add this new route
userRouter.post('/favorites/:id', isUser, addToLibrary);
userRouter.get('/favorites/:userId', isUser, getUserLibrary);
userRouter.get('/feed/:userId', isUser, generateUserFeed);

// Follow/Unfollow artist
userRouter.post('/follow/:userId/:artistId', isUser, followArtist);

// Get followed artists
userRouter.get('/following/:userId', isUser, getFollowedArtists);


userRouter.get('/wallet-balance/:userId', getUserWalletBalance);

export default userRouter;
