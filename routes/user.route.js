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
} = require("../controller/user.controller");
const userrouter = express.Router();

userrouter.get("/isfave/:userId/:artistId", isArtistFave);
userrouter.get("/isfollowing/:userId/:artistId", isUserFollowing);

userrouter.get("/", getAllUsers);
userrouter.get("/getartistbasedonusergenre/:userId", getArtistBasedOnUserGenre);
userrouter.get("/:id", getUser);
userrouter.get("/getartistusersubcribedto/:userId", getArtistUserSubcribeTo);

userrouter.post("/createuser", createUser);
userrouter.post("/creategenresforuser", createGenresForUser);
userrouter.post(
  "/createuserfaveartistbasedongenres",
  createUserFaveArtistBasedOnGenres
);
userrouter.post("/subcribetoartist/:userId/:artistId", subcribeToArtist);
userrouter.post("/addfave/:userId/:artistId", addToFavorite);

userrouter.put("/changepremiumstate/:userId", subcribeToPremium);

userrouter.delete("/:userId", deleteUser);

module.exports = userrouter;
