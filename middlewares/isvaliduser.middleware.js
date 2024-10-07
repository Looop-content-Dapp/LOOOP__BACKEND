const User = require("../models/user.model");

async function isUser(req, res, next) {
  const user = req.params.userId;

  const isUser = await User.findById(user);

  if (!isUser) {
    return res.status(404).json({ message: "User not found" });
  }

  next();
}

module.exports = isUser;
