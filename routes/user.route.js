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
} = require("../controller/user.controller");
const userrouter = express.Router();

userrouter.get("/", getAllUsers);
userrouter.get("/getartistbasedonusergenre", getArtistBasedOnUserGenre);
userrouter.get("/:id", getUser);
userrouter.get("/getartistusersubcribedto/:userId", getArtistUserSubcribeTo);

userrouter.post("/createuser", createUser);
userrouter.post("/creategenresforuser", createGenresForUser);
userrouter.post(
  "/createuserfaveartistbasedongenres",
  createUserFaveArtistBasedOnGenres
);
userrouter.post("/subcribetoartist/:userId/:artistId", subcribeToArtist);

userrouter.put("/changepremiumstate/:userId", subcribeToPremium);

// userrouter.delete("/:id", deleteUsergetAllUsers);

module.exports = userrouter;
