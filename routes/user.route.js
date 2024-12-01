const express = require("express");
const {
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
} = require("../controller/user.controller");
const isUser = require("../middlewares/isvaliduser.middleware");
const userrouter = express.Router();

userrouter.get("/isfave/:userId/:artistId", isArtistFave);
userrouter.get("/isfollowing/:userId/:artistId", isUserFollowing);

userrouter.get("/", getAllUsers);
userrouter.get("/friend/:userId", isUser, getUserFriends);
userrouter.get("/getartistbasedonusergenre/:userId", getArtistBasedOnUserGenre);
userrouter.get("/:id", getUser);
userrouter.get("/getartistusersubcribedto/:userId", getArtistUserSubcribeTo);

userrouter.post("/createuser", createUser);
userrouter.post("/friend/:userId/:friendId", isUser, addFriend);
userrouter.post("/creategenresforuser", createGenresForUser);
userrouter.post(
  "/createuserfaveartistbasedongenres",
  createUserFaveArtistBasedOnGenres
);
userrouter.post("/subcribetoartist/:userId/:artistId", subcribeToArtist);
userrouter.post("/addfave/:userId/:artistId", addToFavorite);

userrouter.put("/changepremiumstate/:userId", subcribeToPremium);

userrouter.delete("/:userId", deleteUser);
userrouter.get("/email/:email", getUserByEmail);
userrouter.post("/signin", signIn);
userrouter.post("/check", checkIfUserNameExist)

module.exports = userrouter;
