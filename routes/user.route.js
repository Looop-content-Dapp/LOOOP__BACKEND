const express = require("express");
const {
  getAllUsers,
  getUser,
  createUser,
  getArtistBasedOnUserGenre,
  createGenresForUser,
  createUserFaveArtistBasedOnGenres,
} = require("../controller/user.controller");
const userrouter = express.Router();

userrouter.get("/", getAllUsers);
userrouter.get("/getartistbasedonusergenre", getArtistBasedOnUserGenre);
userrouter.get("/:id", getUser);

userrouter.post("/createuser", createUser);
userrouter.post("/creategenresforuser", createGenresForUser);
userrouter.post(
  "/createuserfaveartistbasedongenres",
  createUserFaveArtistBasedOnGenres
);

// userrouter.delete("/:id", deleteUsergetAllUsers);

module.exports = userrouter;
