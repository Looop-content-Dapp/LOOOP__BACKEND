import bcrypt from "bcryptjs";
import { config } from "dotenv";
import mongoose, { Types } from "mongoose";
import validator from "validator";
import { Artist } from "../models/artist.model.js";
import { FaveArtist } from "../models/faveartist.model.js";
import { Favorites } from "../models/favorites.model.js";
import { Follow } from "../models/followers.model.js";
import { Friends } from "../models/friends.model.js";
import { LastPlayed } from "../models/lastplayed.model.js";
import { Preferences } from "../models/preferences.model.js";
import { Subscriber } from "../models/subcriber.model.js";
import { User } from "../models/user.model.js";

import referralConfig from "../config/referral.config.js";
import { validateAppleToken } from "../middlewares/appleauth.js";
import { validateGoogleToken } from "../middlewares/googleauth.js";
import { ArtistClaim } from "../models/artistClaim.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import { ReferralCode } from "../models/referralcode.model.js";
import { sendEmail } from "../script.mjs";
import { generateOtp } from "../utils/helpers/generateotp.js";
import { generateUniqueReferralCode } from "../utils/helpers/referralcode.js";
import {
  createUserSchema,
  signInSchema,
} from "../validations_schemas/auth.validation.js";
import XionWalletService from "../xion/wallet.service.js";

import { Release } from "../models/releases.model.js";
import { Track } from "../models/track.model.js";
import { starknetService } from "../services/starknet.service.js";
import AbstraxionAuth from "../xion/AbstraxionAuth.js";

const abstraxionAuth = new AbstraxionAuth();

// Loads .env
config();

const otpStore = {};
const passwordResetTokens = {};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "failed",
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Generate reset token
    const resetToken = generateOtp();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Store token with expiration
    passwordResetTokens[email] = {
      token: resetToken,
      expiresAt,
    };

    // Send reset email
    await sendEmail(email, "Reset Your Password", "reset-password", {
      email,
      resetToken,
    });

    return res.status(200).json({
      status: "success",
      message: "Password reset instructions sent to your email",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error processing password reset request",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        status: "failed",
        message: "Email, token and new password are required",
      });
    }

    // Validate token
    const resetData = passwordResetTokens[email];
    if (!resetData || resetData.token !== token) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid or expired reset token",
      });
    }

    if (Date.now() > resetData.expiresAt) {
      delete passwordResetTokens[email];
      return res.status(400).json({
        status: "failed",
        message: "Reset token has expired",
      });
    }

    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user's password
    user.password = hashedPassword;
    await user.save();

    // Clear reset token
    delete passwordResetTokens[email];

    return res.status(200).json({
      status: "success",
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error resetting password",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    return res.status(200).json({
      message: "successfully get all users",
      data: users,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid user ID" });
    }

    const user = await User.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$_id", { $toObjectId: req.params.id }],
          },
        },
      },
      {
        $lookup: {
          from: "preferences",
          localField: "_id",
          foreignField: "userId",
          as: "preferences",
        },
      },
      {
        $lookup: {
          from: "friends",
          localField: "_id",
          foreignField: "userId",
          as: "friends",
        },
      },
    ]);

    if (user.length === 0) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    // Get followed artists with details
    const followedArtists = await Follow.find({ follower: req.params.id })
      .select("following")
      .lean();

    const artistIds = followedArtists.map((f) => f.following);

    // Get complete details of followed artists
    const followingArtists = await Artist.aggregate([
      {
        $match: { _id: { $in: artistIds } },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          profileImage: 1,
          verified: 1,
          followers: {
            $map: {
              input: "$followers",
              as: "follower",
              in: "$$follower.follower",
            },
          },
          isUserFollowing: true,
        },
      },
    ]);

    const isArtist = await Artist.findOne({
      userId: user[0]._id,
      verified: true,
    });

    const hasClaim = await ArtistClaim.findOne({
      userId: user[0]._id,
    });

    const getUserTribe = await CommunityMember.aggregate([
      {
        $match: {
          userId: user[0]._id,
        },
      },
      {
        $lookup: {
          from: "communities",
          localField: "communityId",
          foreignField: "_id",
          as: "community",
        },
      },
      {
        $unwind: "$community",
      },
      {
        $project: {
          _id: "$community._id",
          communityName: "$community.communityName",
          NFTToken: "$community.NFTToken",
          createdBy: "$community.createdBy",
          memberCount: "$community.memberCount",
          coverImage: "$community.coverImage",
        },
      },
    ]);

    const userData = {
      ...user[0],
      following: followingArtists.length,
      artist: isArtist === null ? null : isArtist?.id,
      artistClaim: hasClaim === null ? null : hasClaim?.id,
      followingArtists: followingArtists,
      communities: getUserTribe,
      friendsCount: user[0].friends && Array.isArray(user[0].friends) ? user[0].friends.length : 0,
    };

    delete userData.password;
    if (userData.wallets && typeof userData.wallets.xion === 'object' && userData.wallets.xion !== null) {
      delete userData.wallets.xion.mnemonic;
      delete userData.wallets.xion._id;
    }
    delete userData.referralCode;
    delete userData.referralCount;
    delete userData.referralCodeUsed;
    console.log("userdata", userData)

    return res.status(200).json({
      status: "success",
      message: "User data fetched successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error in getUser:", error); // Added console.error for detailed logging
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

const checkIfUserNameExist = async (req, res) => {
  try {
    const { username } = req.body;

    if (username == "") {
      console.log("username is needed");
      return "username is needed";
    }

    const existingUser = await User.findOne({ username });
    return res.status(200).json({
      message: "successfully checked if username is",
      data: { existingUser },
    });
  } catch (error) {
    console.log("Error check if username exist", error.message);
    return res
      .status(500)
      .json({ message: "Error checking username", error: error.message });
  }
};

const verifyEmailOTP = async (req, res) => {
  const { email } = req.body;
  const otp = generateOtp();
  otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  const existingEmailUser = await User.findOne({ email });
  if (existingEmailUser) {
    return res
      .status(400)
      .json({ status: "failed", message: "Email already in use" });
  } else
    await sendEmail(email, "Verify your signup email!", "verify", {
      email: email,
      otp: otp,
    });

  return res.status(200).json({
    status: "success",
    message: "Check your email",
    data: { otp },
  });
};

const createUser = async (req, res) => {
  try {
    const {
      email,
      password,
      username,
      fullname,
      age,
      gender,
      referralCode,
      oauthprovider,
      bio,
    } = req.body;

    // Validate request body - the schema will handle password validation based on oauthprovider
    await createUserSchema.validate(req.body);

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res
        .status(400)
        .json({ status: "failed", message: "Email already in use" });
    }

    const existingUsernameUser = await User.findOne({ username });
    if (existingUsernameUser) {
      return res
        .status(400)
        .json({ status: "failed", message: "Username already in use" });
    }

    // Only hash password if it's provided and not empty (for non-OAuth users)
    let hashedPassword;
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const refcode = await generateUniqueReferralCode(username);

    // Create user object with common properties
    const userObj = {
      email,
      username,
      fullname,
      age,
      gender,
      bio,
      referralCode: refcode,
    };

    // Add password only if it exists (for non-OAuth users)
    if (hashedPassword) {
      userObj.password = hashedPassword;
    }

    // Add oauthprovider if it exists
    if (oauthprovider) {
      userObj.oauthprovider = oauthprovider;
    }

    // Create StarkNet wallet and attempt deployment
    let walletInfo;
    try {
      // Create the wallet first
      walletInfo = await starknetService.createUserWallet(email);
      userObj.wallets = {
        starknet: {
          address: walletInfo.address,
          isDeployed: false,
        },
      };

      // Create and save the user
      const user = new User(userObj);
      const savedUser = await user.save();

      // Attempt to deploy the wallet asynchronously
      starknetService
        .deployUserWallet(email)
        .then((deploymentResult) => {
          // Update user's wallet deployment status if successful
          User.findByIdAndUpdate(savedUser._id, {
            "wallets.starknet.isDeployed": true,
          }).exec();
          console.log("Wallet deployed successfully:", deploymentResult);
        })
        .catch((deployError) => {
          console.error("Wallet deployment failed:", deployError);
          // We don't throw here as we want the user creation to succeed regardless
        });

      const referralEntry = new ReferralCode({
        code: refcode,
        userId: savedUser._id,
      });

      await referralEntry.save();

      if (referralCode) {
        const ownerReferral = await ReferralCode.findOne({
          code: referralCode,
        });
        if (ownerReferral) {
          let reward;

          switch (true) {
            case ownerReferral.referralCount === 3:
              reward = referralConfig.referralRewards.NEW_USER_SIGNUP;
              break;
            case ownerReferral.referralCount === 10:
              reward = referralConfig.referralRewards.PURCHASE;
              break;
            case ownerReferral.referralCount === 5:
              reward = referralConfig.referralRewards.PROFILE_COMPLETION;
              break;
            default:
              reward = referralConfig.referralRewards.SOCIAL_SHARE;
              break;
          }
          ownerReferral.rewardPoints += reward.points;
          ownerReferral.rewardsHistory.push({
            points: reward.points,
            reason: reward.description,
            date: new Date(),
          });
          await ownerReferral.save();

          await User.findByIdAndUpdate(ownerReferral.userId, {
            $push: { referralCodeUsed: savedUser._id },
            $inc: { referralCount: 1 },
          });
        }
      }

      const followedArtists = await Follow.find({ follower: savedUser._id })
        .select("following")
        .lean();

      const artistIds = followedArtists.map((f) => f.following);

      // Get complete details of followed artists
      const followingArtists = await Artist.aggregate([
        {
          $match: { _id: { $in: artistIds } },
        },
        {
          $lookup: {
            from: "follows",
            localField: "_id",
            foreignField: "following",
            as: "followers",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            profileImage: 1,
            verified: 1,
            followers: {
              $map: {
                input: "$followers",
                as: "follower",
                in: "$$follower.follower",
              },
            },
            isUserFollowing: true,
          },
        },
      ]);

      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;

      userWithoutPassword.following = followingArtists.length;
      userWithoutPassword.followingArtists = followingArtists;

      return res.status(200).json({
        status: "success",
        message: "Successfully created a user",
        data: { user: userWithoutPassword },
      });
    } catch (walletError) {
      console.error("Wallet creation error:", walletError);
      return res.status(500).json({
        status: "failed",
        message: "Error creating user wallet",
        error: walletError.message,
      });
    }
  } catch (error) {
    console.log(error, "error");
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email]) {
    return res
      .status(400)
      .json({ status: "failed", message: "OTP not found or expired" });
  }

  if (otpStore[email].otp !== otp) {
    return res.status(400).json({ status: "failed", message: "Invalid OTP" });
  }

  const currentTime = Date.now();
  if (currentTime > otpStore[email].expiresAt) {
    delete otpStore[email];
    return res
      .status(400)
      .json({ status: "failed", message: "OTP has expired" });
  }

  delete otpStore[email];
  return res
    .status(200)
    .json({ status: "success", message: "OTP verified successfully" });
};

const isUserFollowing = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const data = await Follow.find({
      follower: userId,
      following: artistId,
    });

    return res.status(200).json({
      bool: data.length > 0 ? true : false,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID format",
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Delete all associated data in a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Delete user's preferences
        await Preferences.deleteMany({ userId }, { session });

        // Delete user's favorite artists
        await FaveArtist.deleteMany({ userId }, { session });

        // Delete user's follows and followers
        await Follow.deleteMany(
          {
            $or: [{ follower: userId }, { following: userId }],
          },
          { session }
        );

        // Delete user's friends relationships
        await Friends.deleteMany(
          {
            $or: [{ userId }, { friendId: userId }],
          },
          { session }
        );

        // Delete user's community memberships
        await CommunityMember.deleteMany({ userId }, { session });

        // Delete user's last played tracks
        await LastPlayed.deleteMany({ userId }, { session });

        // Delete user's favorites
        await Favorites.deleteMany({ userId }, { session });

        // Delete user's referral codes
        await ReferralCode.deleteMany({ userId }, { session });

        // Delete user's subscriptions
        await Subscriber.deleteMany({ userId }, { session });

        // Delete the user
        await User.deleteOne({ _id: userId }, { session });
      });

      await session.commitTransaction();
      return res.status(200).json({
        status: "success",
        message: "User and all associated data deleted successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error deleting user",
      error: error.message,
    });
  }
};

const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.aggregate([
      {
        $match: { email: email },
      },
      {
        $lookup: {
          from: "preferences",
          localField: "_id",
          foreignField: "userId",
          as: "preferences",
        },
      },
      {
        $lookup: {
          from: "faveartists",
          localField: "_id",
          foreignField: "userId",
          as: "faveArtists",
        },
      },
      {
        $unwind: {
          path: "$faveArtists",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "follower",
          as: "following",
        },
      },
      {
        $lookup: {
          from: "friends",
          localField: "_id",
          foreignField: "userId",
          as: "friends",
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "faveArtists.artistId",
          foreignField: "_id",
          as: "faveArtists.artist",
        },
      },
      {
        $addFields: {
          following: { $size: "$following" },
          friendsCount: { $size: "$friends" },
          artistPlayed: { $size: "$friends" },
        },
      },
      {
        $group: {
          _id: "$_id",
          faveArtist: { $push: "$faveArtists" },
          otherFields: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$otherFields", { faveArtists: "$faveArtist" }],
          },
        },
      },
      {
        $project: {
          friends: 0,
          password: 0, // Remove password from response for security
        },
      },
    ]);

    if (!user || user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const artistPlayed = await LastPlayed.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$userId", user[0]._id],
          },
        },
      },
      {
        $lookup: {
          from: "tracks",
          localField: "trackId",
          foreignField: "_id",
          as: "track",
        },
      },
      {
        $unwind: {
          path: "$track",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    let uniqueArtists = [];
    let uniqueTracks = [];
    artistPlayed.forEach((val) => {
      if (!uniqueArtists.includes(val.track.artistId.toString())) {
        uniqueArtists.push(val.track.artistId.toString());
        uniqueTracks.push(val.track);
      }
    });

    return res.status(200).json({
      message: "Successfully retrieved user",
      data: { ...user[0], artistPlayed: uniqueTracks.length },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching user by email",
      error: error.message,
    });
  }
};

const signIn = async (req, res) => {
  try {
    await signInSchema.validate(req.body);
    const { email, password } = req.body;

    const user = await User.find({
      email: email,
    });

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const isArtist = await Artist.findOne({
      userId: user[0]._id,
      verified: true,
    });

    const hasClaim = await ArtistClaim.findOne({
      userId: user[0]._id,
    });

    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    console.log(isPasswordValid)

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        message: "Incorrect password",
      });
    }

    // Get followed artists with details
    const followedArtists = await Follow.find({ follower: user[0]._id })
      .select("following")
      .lean();

    const artistIds = followedArtists.map((f) => f.following);

    // Get complete details of followed artists
    const followingArtists = await Artist.aggregate([
      {
        $match: { _id: { $in: artistIds } },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          profileImage: 1,
          verified: 1,
          followers: {
            $map: {
              input: "$followers",
              as: "follower",
              in: "$$follower.follower",
            },
          },
          isUserFollowing: true,
        },
      },
    ]);

    const userData = {
      ...user[0]._doc,
      wallets: {
        ...user[0]._doc.wallets,
        xion: {
          address: user[0]._doc.wallets.xion.address,
        },
      },
      artist: isArtist === null ? null : isArtist?.id,
      artistClaim: hasClaim === null ? null : hasClaim?.id,
      following: followingArtists.length,
      followingArtists: followingArtists,
    };
    delete userData.password;
    delete userData.referralCode;
    delete userData.referralCount;
    delete userData.referralCodeUsed;

    const emailResult = await sendEmail(
      user[0].email,
      "New Login Detected",
      "login",
      {
        username: user[0].username,
        loginTime: new Date().toLocaleString(),
        deviceInfo: req.headers["user-agent"],
        ipAddress: req.ip,
      }
    );
    console.log("email result", emailResult);

    return res.status(200).json({
      status: "success",
      message: "Sign in successful",
      data: {
        ...userData,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error signing in",
      error: error.message,
    });
  }
};

export const oauth = async (req, res) => {
  try {
    const { email, token, channel } = req.body;

    let isTokenValid;

    if (channel === "google") {
      isTokenValid = await validateGoogleToken(token, email);
    } else {
      isTokenValid = await validateAppleToken(token, email);
    }

    if (!isTokenValid) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid token",
      });
    }

    let user = await User.findOne({ email: email });

    if (!user) {
      const newUser = new User({
        email: email,
      });

      return res.status(200).json({
        status: "success",
        message: "User created successfully",
        data: {
          user: {
            ...(newUser?.toObject ? newUser.toObject() : newUser),
          },
          isNewUser: true,
        },
      });
    }

    // Get followed artists with details
    const followedArtists = await Follow.find({ follower: user._id })
      .select("following")
      .lean();

    const artistIds = followedArtists.map((f) => f.following);

    // Get complete details of followed artists
    const followingArtists = await Artist.aggregate([
      {
        $match: { _id: { $in: artistIds } },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          profileImage: 1,
          verified: 1,
          followers: {
            $map: {
              input: "$followers",
              as: "follower",
              in: "$$follower.follower",
            },
          },
          isUserFollowing: true,
        },
      },
    ]);

    // existing user checks
    const isArtist = await Artist.findOne({
      userId: user._id,
      verified: true,
    });

    const hasClaim = await ArtistClaim.findOne({
      userId: user._id,
    });

    try {
      const xionLoggedInUser = await XionWalletService.loginAccount(email);

      if (!xionLoggedInUser) {
        const userData = {
          ...user._doc,
          artist: isArtist === null ? null : isArtist?.id,
          artistClaim: hasClaim === null ? null : hasClaim?.id,
          following: followingArtists.length,
          followingArtists: followingArtists,
        };
        delete userData.password;
        delete userData.referralCode;
        delete userData.referralCount;
        delete userData.referralCodeUsed;

        return res.status(200).json({
          status: "success",
          message: "Sign in successful (wallet service unavailable)",
          data: userData,
        });
      }

      const userData = {
        ...user._doc,
        wallets: {
          ...user._doc.wallets,
          xion: {
            address: xionLoggedInUser.walletAddress,
          },
        },
        artist: isArtist === null ? null : isArtist?.id,
        artistClaim: hasClaim === null ? null : hasClaim?.id,
        following: followingArtists.length,
        followingArtists: followingArtists,
      };
      delete userData.password;
      delete userData.referralCode;
      delete userData.referralCount;
      delete userData.referralCodeUsed;

      return res.status(200).json({
        status: "success",
        message: "Sign in successful",
        data: userData,
      });
    } catch (walletError) {
      console.error("Wallet service error:", walletError);

      const userData = {
        ...user._doc,
        artist: isArtist === null ? null : isArtist?.id,
        artistClaim: hasClaim === null ? null : hasClaim?.id,
        following: followingArtists.length,
        followingArtists: followingArtists,
      };
      delete userData.password;
      delete userData.referralCode;
      delete userData.referralCount;
      delete userData.referralCodeUsed;

      return res.status(200).json({
        status: "success",
        message: "Sign in successful (wallet service unavailable)",
        data: userData,
      });
    }
  } catch (error) {
    console.error("OAuth error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error signing in",
      error: error.message,
    });
  }
};

// Generate personalized feed based on followed artists
const generateUserFeed = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID",
      });
    }

    // Get all artists the user follows with full artist details
    const followedArtists = await Follow.find({ follower: userId })
      .select("following")
      .lean();

    const artistIds = followedArtists.map((f) => f.following);

    // Get complete details of followed artists - only select needed fields
    const followedArtistsDetails = await Artist.aggregate([
      {
        $match: { _id: { $in: artistIds } },
      },
      {
        // Get all followers for each artist
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          profileImage: 1,
          verified: 1,
          followers: {
            $map: {
              input: "$followers",
              as: "follower",
              in: "$$follower.follower",
            },
          },
          isUserFollowing: true,
        },
      },
      { $limit: 10 },
    ]);

    // Get recent releases from followed artists - only select needed fields
    const recentReleases = await Release.find({
      artistId: { $in: artistIds },
      "dates.release_date": {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    })
      .select("_id title artwork type dates.release_date")
      .populate({
        path: "artistId",
        model: "artist",
        select: "_id name profileImage",
      })
      .sort({ "dates.release_date": -1 })
      .limit(10);

    // Get user's favorite genres
    const userGenres = await Preferences.find({ userId })
      .select("genreId")
      .lean();

    const genreIds = userGenres.map((g) => g.genreId);

    // Get genres of followed artists to find similar artists
    const followedArtistsGenres = await Artist.find({ _id: { $in: artistIds } })
      .select("genres")
      .lean();

    const followedGenreIds = [
      ...new Set(followedArtistsGenres.flatMap((artist) => artist.genres)),
    ];

    // Get recommended artists based on genre overlap with followed artists
    const recommendedArtists = await Artist.aggregate([
      {
        $match: {
          _id: { $nin: artistIds },
          genres: { $in: [...genreIds, ...followedGenreIds] },
        },
      },
      {
        $lookup: {
          from: "follows",
          localField: "_id",
          foreignField: "following",
          as: "followers",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          profileImage: 1,
          verified: 1,
          followers: {
            $map: {
              input: "$followers",
              as: "follower",
              in: "$$follower.follower",
            },
          },
        },
      },
      { $limit: 10 },
    ]);

    // Get songs from both followed and recommended artists
    const allArtistIds = [
      ...artistIds,
      ...recommendedArtists.map((a) => a._id),
    ];

    // IMPROVED: Get tracks with better distribution across artists
    // First, get a sample of tracks from each followed artist (up to 2 per artist)
    let tracksFromFollowed = [];
    for (const artistId of artistIds) {
      const artistTracks = await Track.find({ artistId })
        .select("_id title duration artistId releaseId")
        .populate({
          path: "artistId",
          model: "artist",
          select: "_id name profileImage verified",
        })
        .populate({
          path: "releaseId",
          model: "releases",
          select: "_id title artwork type",
        })
        .sort({ createdAt: -1 }) // Prefer newer tracks
        .limit(2); // Limit to 2 tracks per followed artist

      tracksFromFollowed = [...tracksFromFollowed, ...artistTracks];
    }

    // Then get tracks from recommended artists (1 per artist)
    let tracksFromRecommended = [];
    for (const artist of recommendedArtists) {
      const artistTrack = await Track.findOne({ artistId: artist._id })
        .select("_id title duration artistId releaseId")
        .populate({
          path: "artistId",
          model: "artist",
          select: "_id name profileImage verified",
        })
        .populate({
          path: "releaseId",
          model: "releases",
          select: "_id title artwork type",
        })
        .sort({ playCount: -1 }); // Get the most popular track

      if (artistTrack) {
        tracksFromRecommended.push(artistTrack);
      }
    }

    // Combine and shuffle to create variety
    const allTracks = [...tracksFromFollowed, ...tracksFromRecommended];

    // Fisher-Yates shuffle algorithm for randomizing track order
    for (let i = allTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
    }

    // Limit to 10 tracks total
    const limitedTracks = allTracks.slice(0, 10);

    // Transform tracks to a more minimal format
    const formattedTracks = limitedTracks.map((track) => ({
      _id: track._id,
      title: track.title,
      duration: track.duration,
      artist: {
        _id: track.artistId._id,
        name: track.artistId.name,
        profileImage: track.artistId.profileImage,
        verified: track.artistId.verified,
      },
      release: track.releaseId
        ? {
            _id: track.releaseId._id,
            title: track.releaseId.title,
            image: track.releaseId.artwork.cover_image.high,
            type: track.releaseId.type,
          }
        : null,
      isFromFollowedArtist: artistIds.some((id) =>
        id.equals(track.artistId._id)
      ),
    }));

    // Still prioritize followed artists but maintain the variety
    formattedTracks.sort((a, b) => {
      if (a.isFromFollowedArtist && !b.isFromFollowedArtist) return -1;
      if (!a.isFromFollowedArtist && b.isFromFollowedArtist) return 1;
      return 0;
    });

    return res.status(200).json({
      status: "success",
      message: "Successfully generated user feed",
      data: {
        followedArtists: followedArtistsDetails,
        recentReleases,
        recommendedArtists,
        suggestedTracks: formattedTracks,
      },
    });
  } catch (error) {
    console.error("Feed generation error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error generating feed",
      error: error.message,
    });
  }
};

const followArtist = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    if (!validator.isMongoId(userId) || !validator.isMongoId(artistId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid ID format",
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: userId,
      following: artistId,
    });

    if (existingFollow) {
      // Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });
      await Artist.findByIdAndUpdate(artistId, {
        $inc: { followers: -1 }, // Updated to match model structure
      });

      return res.status(200).json({
        status: "success",
        message: "Successfully unfollowed artist",
        isFollowing: false,
      });
    }

    // Create new follow
    const newFollow = new Follow({
      follower: userId,
      following: artistId,
      followedAt: new Date(),
    });
    await newFollow.save();

    // Update artist followers count
    await Artist.findByIdAndUpdate(artistId, {
      $inc: { followers: 1 }, // Updated to match model structure
    });

    return res.status(200).json({
      status: "success",
      message: "Successfully followed artist",
      isFollowing: true,
    });
  } catch (error) {
    return res.status(500).json({
      status: "failed",
      message: "Error following artist",
      error: error.message,
    });
  }
};

const getFollowedArtists = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID",
      });
    }

    const skip = (page - 1) * limit;

    const followedArtists = await Follow.aggregate([
      {
        $match: { follower: new Types.ObjectId(userId) },
      },
      {
        $lookup: {
          from: "artists",
          localField: "following",
          foreignField: "_id",
          as: "artistDetails",
        },
      },
      {
        $unwind: "$artistDetails",
      },
      {
        $lookup: {
          from: "communities",
          localField: "artistDetails._id",
          foreignField: "createdBy",
          as: "community",
        },
      },
      {
        $addFields: {
          "artistDetails.isFollowed": true,
          "artistDetails.community": { $arrayElemAt: ["$community", 0] },
        },
      },
      {
        $project: {
          _id: "$artistDetails._id",
          name: "$artistDetails.name",
          profileImage: "$artistDetails.profileImage",
          followers: "$artistDetails.followers",
          isFollowed: "$artistDetails.isFollowed",
          communityName: "$artistDetails.community.communityName",
          tribestars: "$artistDetails.community.NFTToken",
          followedAt: "$followedAt",
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    const total = await Follow.countDocuments({ follower: userId });

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved followed artists",
      data: {
        artists: followedArtists,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasMore: skip + followedArtists.length < total,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "failed",
      message: "Error fetching followed artists",
      error: error.message,
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID format",
      });
    }

    // Fields that are not allowed to be updated
    const restrictedFields = [
      "email",
      "password",
      "username",
      "wallets",
      "role",
      "isPremium",
      "referralCode",
      "referralCount",
      "referralCodeUsed",
    ];

    // Remove restricted fields from update data
    restrictedFields.forEach((field) => delete updateData[field]);

    // Validate profile image URL if provided
    if (updateData.profileImage && !validator.isURL(updateData.profileImage)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid profile image URL format",
      });
    }

    // Validate social links if provided
    if (updateData.socialLinks) {
      if (
        updateData.socialLinks.website &&
        !validator.isURL(updateData.socialLinks.website)
      ) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid website URL format",
        });
      }
    }

    // Validate phone number if provided
    if (updateData.tel && !validator.isMobilePhone(updateData.tel.toString())) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid phone number format",
      });
    }

    // Validate preferences if provided
    if (updateData.preferences) {
      if (
        updateData.preferences.currency &&
        !["USD", "EUR", "GBP", "NGN", "GHS", "KES", "ZAR"].includes(
          updateData.preferences.currency
        )
      ) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid currency",
        });
      }

      if (
        updateData.preferences.chain &&
        !["XION", "STARKNET", "ETHEREUM", "POLYGON"].includes(
          updateData.preferences.chain
        )
      ) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid chain",
        });
      }

      if (
        updateData.preferences.theme &&
        !["light", "dark", "system"].includes(updateData.preferences.theme)
      ) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid theme",
        });
      }

      if (
        updateData.preferences.displayMode &&
        !["compact", "comfortable"].includes(updateData.preferences.displayMode)
      ) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid display mode",
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        select:
          "-password -wallets.xion.mnemonic -wallets.xion._id -referralCode -referralCount -referralCodeUsed",
      }
    );

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error updating profile",
      error: error.message,
    });
  }
};

const getUserWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID format",
      });
    }

    // Get user document to fetch wallet addresses
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const starknetAddress = user.wallets?.starknet?.address;

    // Get both XION and StarkNet balances using AbstraxionAuth
    const balanceData = await starknetService.getStarkNetUSDCBalance(
      starknetAddress,
      "0x0475e85c9f471885c1624c297862df9aaffa82ad55c7d1fde1ac892232445e06"
    );

    console.log("balanceData", balanceData);

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved wallet balances",
      data: {
        starknet: starknetAddress
          ? {
              address: starknetAddress,
              balance: balanceData.balanceFloat,
              usdValue: balanceData.usdValue,
              usdcPrice: balanceData.usdcPrice,
            }
          : null,
        usdcPrice: balanceData.usdcPrice,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet balances:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error fetching wallet balances",
      error: error.message,
    });
  }
};

export {
  checkIfUserNameExist,
  createUser,
  deleteUser,
  followArtist,
  generateUserFeed,
  getAllUsers,
  getFollowedArtists,
  getUser,
  getUserByEmail,
  getUserWalletBalance,
  isUserFollowing,
  requestPasswordReset,
  resetPassword,
  signIn,
  updateUserProfile,
  verifyEmailOTP,
  verifyOtp,
};
