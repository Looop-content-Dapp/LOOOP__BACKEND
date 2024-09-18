const User = require("../models/user.model");

async function isPremiumUser(req, res, next) {
  const user = req.params.userId;

  const isPremium = await User.findOne({ userId: user }, "isPremium");

  if (!isPremium) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!isPremium.isPremium) {
    return res.status(403).json({ message: "User is not premium" });
  }

  next();
}

module.exports = isPremiumUser;
