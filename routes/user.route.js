const express = require("express");
const {
  getAllUsers,
  getUser,
  createUser,
} = require("../controller/user.controller");
const userrouter = express.Router();

userrouter.get("/", getAllUsers);
userrouter.get("/:id", getUser);
userrouter.post("/createuser", createUser);
// userrouter.delete("/:id", deleteUsergetAllUsers);

module.exports = userrouter;
