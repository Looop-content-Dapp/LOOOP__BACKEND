import { User } from "../../models/user.model.js";
import bcrypt from "bcryptjs";
import { createAuthToken } from "../../utils/helpers/jwtauth.js";

export const registerAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["email", "password", "name"]
      });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email, role: "ADMIN" });
    if (existingAdmin) {
      return res.status(409).json({
        message: "Admin already exists with this email"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await User.create({
      email,
      password: hashedPassword,
      name,
      role: "ADMIN",
      isVerified: true
    });

    // Generate auth token
    const token = createAuthToken({
      userId: admin._id,
      role: admin.role
    });

    return res.status(201).json({
      message: "Admin registered successfully",
      data: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        token
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error registering admin",
      error: error.message
    });
  }
};
