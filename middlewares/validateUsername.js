import { User } from '../models/user.model.js';

export const validateUsername = async (req, res, next) => {
  try {
    const { username } = req.body;

    // Skip validation if no username provided (will be generated later)
    if (!username) {
      return next();
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists. Please choose a different username."
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Error validating username",
      error: error.message
    });
  }
};