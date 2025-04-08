import { verifyAuthToken } from "../utils/helpers/jwtauth.js";
import { User } from "../models/user.model.js";

export const isAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const decoded = await verifyAuthToken(token);
    const user = await User.findById(decoded.userId);

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
      error: error.message
    });
  }
};
