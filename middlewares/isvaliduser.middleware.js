import { User } from "../models/user.model.js";

export async function isUser(req, res, next) {
  const user = req.params.userId || req.body.userId;

  const isUser = await User.findById(user);

  if (!isUser) {
    return res.status(404).json({ message: "User not found" });
  }

  next();
}
