import { User } from "../models/user.model";

export async function isPremiumUser(req, res, next) {
  const { userId } = req.body;

  const isPremium = await User.findById(userId, "isPremium");

  console.log(isPremium);
  if (!isPremium) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!isPremium.isPremium) {
    return res.status(403).json({ message: "User is not premium" });
  }

  next();
}
