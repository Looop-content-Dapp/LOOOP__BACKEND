import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";
import { config } from "dotenv";
import {
  TokenboundClient,
  TBAVersion,
  TBAChainID,
} from "starknet-tokenbound-sdk";
import { User } from "../models/user.model.js";
import { Preferences } from "../models/preferences.model.js";
import { FaveArtist } from "../models/faveartist.model.js";
import { Artist } from "../models/artist.model.js";
import { Subscriber } from "../models/subcriber.model.js";
import { Follow } from "../models/followers.model.js";
import { Friends } from "../models/friends.model.js";
import { matchUser } from "../utils/helpers/searchquery.js";
import { LastPlayed } from "../models/lastplayed.model.js";
import { Favorites } from "../models/favorites.model.js";

import { Genre } from "../models/genre.model.js";
import { Community } from "../models/community.model.js";
import { ArtistClaim } from "../models/artistClaim.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import { sendEmail } from "../script.js";
import { generateOtp } from "../utils/helpers/generateotp.js";
import {
  createUserSchema,
  signInSchema,
  walletAuthSchema,
} from "../validations_schemas/auth.validation.js";
import { validateGoogleToken } from "../middlewares/googleauth.js";
import { validateAppleToken } from "../middlewares/appleauth.js";
import { generateUniqueReferralCode } from "../utils/helpers/referralcode.js";
import { ReferralCode } from "../models/referralcode.model.js";
import referralConfig from "../config/referral.config.js";
import XionWalletService from "../xion/wallet.service.js";

import AbstraxionAuth from "../xion/AbstraxionAuth.js";
import { Track } from "../models/track.model.js";
import { Release } from "../models/releases.model.js";
import * as yup from "yup";

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
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    // Generate reset token
    const resetToken = generateOtp();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Store token with expiration
    passwordResetTokens[email] = {
      token: resetToken,
      expiresAt
    };

    // Send reset email
    await sendEmail(email, "Reset Your Password", "reset-password", {
      email,
      resetToken
    });

    return res.status(200).json({
      status: "success",
      message: "Password reset instructions sent to your email"
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error processing password reset request",
      error: error.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        status: "failed",
        message: "Email, token and new password are required"
      });
    }

    // Validate token
    const resetData = passwordResetTokens[email];
    if (!resetData || resetData.token !== token) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid or expired reset token"
      });
    }

    if (Date.now() > resetData.expiresAt) {
      delete passwordResetTokens[email];
      return res.status(400).json({
        status: "failed",
        message: "Reset token has expired"
      });
    }

    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
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
      message: "Password has been reset successfully"
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error resetting password",
      error: error.message
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
      friendsCount: user[0].friends.length,
    };

    delete userData.password;
    delete userData.wallets.xion.mnemonic;
    delete userData.wallets.xion._id;
    delete userData.referralCode;
    delete userData.referralCount;
    delete userData.referralCodeUsed;

    return res.status(200).json({
      status: "success",
      message: "User data fetched successfully",
      data: userData,
    });
  } catch (error) {
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
        channel,
        oauthprovider,
        walletAddress,
        bio
      } = req.body;

      // Check which authentication method is being used
      const isWalletAuth = oauthprovider === "xion" || oauthprovider === "argent";

      // Skip validation for wallet-based authentication or OAuth providers
      if (isWalletAuth) {
        // For wallet-based auth, validate with custom wallet schema
        if (!walletAddress) {
          return res.status(400).json({
            status: "failed",
            message: "Wallet address is required for wallet authentication"
          });
        }

        // Then validate the user data with a modified schema
        const walletUserSchema = yup.object().shape({
          username: yup.string().trim().required("Username is required"),
          fullname: yup.string().trim().required("Fullname is required"),
          age: yup.string().trim().required("Age is required"),
          gender: yup
            .string()
            .trim()
            .oneOf(["male", "female"], "Gender must be 'male' or 'female'")
            .required("Gender is required"),
        });

        await walletUserSchema.validate({
          username,
          fullname,
          age,
          gender,
        });
      } else if (oauthprovider === "oauth") {
        // OAuth validation
        const oauthSchema = createUserSchema.clone();
        oauthSchema.fields.password = oauthSchema.fields.password.optional();
        await oauthSchema.validate(req.body);
      } else {
        // Traditional email/password validation
        await createUserSchema.validate(req.body);
      }

      // Check for existing username
      const existingUsernameUser = await User.findOne({ username });
      if (existingUsernameUser) {
        return res
          .status(400)
          .json({ status: "failed", message: "Username already in use" });
      }

      // Check for existing email if provided
      if (email) {
        const existingEmailUser = await User.findOne({ email });
        if (existingEmailUser) {
          return res
            .status(400)
            .json({ status: "failed", message: "Email already in use" });
        }
      }

      // Check for existing wallet if provided
      if (walletAddress && isWalletAuth) {
        const walletField = oauthprovider === "xion" ? "wallets.xion.address" : "wallets.starknet.address";
        const existingWalletUser = await User.findOne({ [walletField]: walletAddress });
        if (existingWalletUser) {
          return res
            .status(400)
            .json({ status: "failed", message: "Wallet address already associated with an account" });
        }
      }

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
      }

      // Generate a simple salt for token bound account
      const generateSimpleSalt = () => {
        return Math.random().toString(36).substring(2, 10);
      };

      // Setup token bound account (existing code)
      const account = {
        address: process.env.ACCT_ADDRESS,
        privateKey: process.env.PRIVATE_KEY,
      };

      const options = {
        walletClient: account,
        version: TBAVersion.V3,
        chain_id: TBAChainID.sepolia,
        jsonRPC:
          "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/SJrfoNSORPvz7PkhNneqhqTpnielFNxS",
      };

      const tokenbound = new TokenboundClient(options);
      let xionwallet = null;

      // Setup wallets based on authentication channel
      let wallets = {};

      // Create Starknet token bound account
      const starknetTokenBoundAccount = await tokenbound.createAccount({
        tokenContract: process.env.NFT_CONTRACT_ADDRESS,
        tokenId: process.env.NFT_TOKEN_ID,
        salt: username,
      });

      wallets.starknet = {
        address: starknetTokenBoundAccount.account,
      };

      // Setup Xion wallet based on authentication method
      if (oauthprovider === "xion" && walletAddress) {
        // If it's a Xion wallet auth, use the provided wallet address
        wallets.xion = {
          address: walletAddress,
          mnemonic: "wallet-auth-no-mnemonic" // Placeholder for schema requirement
        };
      } else if (email && oauthprovider !== "xion" && oauthprovider !== "argent") {
        // Create new Xion wallet through auth service if email is provided and not using wallet auth
        xionwallet = await abstraxionAuth.signup(email);
        if (xionwallet) {
          wallets.xion = {
            address: xionwallet.address,
            mnemonic: xionwallet.mnemonic,
          };
        } else {
          // If wallet creation failed
          return res.status(400).json({
            status: "failed",
            message: "Failed to create Xion wallet. Please try again later."
          });
        }
      } else {
        // For non-Xion auth without email, create a placeholder wallet address
        wallets.xion = {
          address: `wallet-${Date.now()}`,
          mnemonic: "wallet-auth-no-mnemonic"
        };
      }

      // Generate referral code
      const refcode = await generateUniqueReferralCode(username);

      // Create user object based on authentication method
      const userData = {
        username,
        fullname,
        age,
        gender,
        wallets,
        referralCode: refcode,
        bio: bio || null,
      };

      // Add email only if provided, not adding placeholder emails
      if (email) {
        userData.email = email;
      }

      // Add password if provided
      if (hashedPassword) userData.password = hashedPassword;

      const user = new User(userData);
      const savedUser = await user.save();

      // Create referral entry
      const referralEntry = new ReferralCode({
        code: refcode,
        userId: savedUser._id,
      });

      await referralEntry.save();

      // Process referral if provided (existing code)
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

      // Get followed artists (same as original code)
      const followedArtists = await Follow.find({ follower: savedUser._id })
        .select("following")
        .lean();

      const artistIds = followedArtists.map((f) => f.following);

      // Get complete details of followed artists (same as original code)
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

      // If Xion wallet has mnemonic, don't expose it
      if (userWithoutPassword.wallets?.xion?.mnemonic) {
        userWithoutPassword.wallets.xion = {
          address: userWithoutPassword.wallets.xion.address
        };
      }

      userWithoutPassword.following = followingArtists.length;
      userWithoutPassword.followingArtists = followingArtists;

      return res.status(200).json({
        status: "success",
        message: "Successfully created a user",
        data: { user: userWithoutPassword },
      });
    } catch (error) {
      console.log(error, "error");
      return res.status(500).json({
        status: "failed",
        message: "Error creating user",
        error: error.message,
      });
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

const createGenresForUser = async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID",
      });
    }

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({
        status: "failed",
        message:
          "Invalid preferences array, preference should be an array of string(s)",
      });
    }

    if (preferences.length === 0) {
      return res.status(400).json({
        status: "failed",
        message:
          "Invalid preferences array, preference should be an array of string(s)",
      });
    }

    const user = await User.findById(userId);

    if (user === null) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    const parsePeferences = JSON.parse(JSON.stringify(preferences));

    for (let i = 0; i < parsePeferences.length; i++) {
      if (!validator.isMongoId(parsePeferences[i])) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid genre ID",
        });
      }

      const genreExist = await Genre.findById(parsePeferences[i]);
      if (genreExist === null) {
        return res.status(400).json({
          status: "failed",
          message: "Genre does not exist",
        });
      }

      const element = parsePeferences[i];
      const peference = new Preferences({
        genreId: element,
        userId: user.id,
      });
      await peference.save();
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully saved all genres for user",
      data: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating all genres for user",
      error: error.message,
    });
  }
};

const getArtistBasedOnUserGenre = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const userGenresPreferences = await Preferences.find({ userId });
    if (userGenresPreferences.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "No genres found for user",
      });
    }

    const findFavourites = await FaveArtist.find({ userId });
    const favouriteArtistIds = findFavourites.map((fav) =>
      fav.artistId.toString()
    );

    const processedGenres = new Set();
    const genreArtistData = [];

    for (const preference of userGenresPreferences) {
      const genre = await Genre.findById(preference.genreId);
      if (!genre || processedGenres.has(genre._id.toString())) {
        continue;
      }

      processedGenres.add(genre._id.toString());

      const artists = await Artist.find({ genres: { $in: [genre._id] } });
      const artistMap = new Map();

      const artistsWithCommunity = await Promise.all(
        artists.map(async (artist) => {
          if (artistMap.has(artist._id.toString())) return null;
          artistMap.set(artist._id.toString(), true);

          const artistCommunity = await Community.findOne({
            createdBy: artist._id,
          });

          return {
            id: artist._id,
            name: artist.name,
            tribeName: artistCommunity?.communityName || "Unknown Tribe",
            tribestars: artistCommunity?.NFTToken || 0,
            profileImage: artist.profileImage || "default_image_url",
            isFavourite: favouriteArtistIds.includes(artist._id.toString()),
          };
        })
      );

      genreArtistData.push({
        genreName: genre.name,
        artists: artistsWithCommunity.filter(Boolean),
      });
    }

    if (genreArtistData.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "No artist data found for user genres",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved artists based on user genres",
      data: genreArtistData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      message: "Error fetching artists based on genre of user",
      error: error.message,
    });
  }
};

const createUserFaveArtistBasedOnGenres = async (req, res) => {
  try {
    const { userId, faveArtist } = req.body;
    const parseFaveArtist = JSON.parse(JSON.stringify(faveArtist));

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    for (let i = 0; i < parseFaveArtist.length; i++) {
      const findArtist = await Artist.findOne({
        _id: parseFaveArtist[i],
      });
      if (findArtist) {
        const element = parseFaveArtist[i];

        const existingFave = await FaveArtist.findOne({
          artistId: element,
          userId: userId,
        });

        if (existingFave) {
          await FaveArtist.deleteOne({
            artistId: element,
            userId: userId,
          });
        } else {
          const faveArtist = new FaveArtist({
            artistId: element,
            userId: userId,
          });
          await faveArtist.save();
        }
      } else {
        return res.status(404).json({
          status: "failed",
          message: "Artist not found",
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully updated user's favorite artists",
      data: null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating user's favorite artists",
      error: error.message,
    });
  }
};

const subcribeToPremium = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findOneAndUpdate(
      {
        _id: userId,
      },
      {
        $set: {
          isPremium: user.isPremium == true ? false : true,
        },
      }
    );

    return res.status(200).json({
      message: `successfully ${
        user.isPremium == true ? "unsubcribe from" : "subcribe to"
      } premium`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error subcribing to premium",
      error: error.message,
    });
  }
};

const subcribeToArtist = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const alreadyFriends = await Subscriber.findOne({
      userId: userId,
      artistId: artistId,
    });

    if (alreadyFriends) {
      await Subscriber.deleteOne({
        userId: userId,
        artistId: artistId,
      });
    } else {
      const subcriber = await Subscriber({
        userId,
        artistId,
      });
      await subcriber.save();
    }

    return res.status(200).json({
      message: `successfully ${
        alreadyFriends ? "unsubcribed" : "subcribed"
      } to artist`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error subcribing to artist",
      error: error.message,
    });
  }
};

const getArtistUserSubcribeTo = async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await Subscriber.find({
      userId: userId,
    });

    return res.status(200).json({
      message: `successfully gotten data`,
      data,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
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

    await User.deleteOne({
      _id: userId,
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

const addFriend = async (req, res) => {
  try {
    const { userId, friendId } = req.params;

    const alreadyFriends = await Friends.findOne({
      friendId: friendId,
      userId: userId,
    });

    if (alreadyFriends) {
      await Friends.deleteOne({
        friendId: friendId,
        userId: userId,
      });
    } else {
      const follower = await Friends({
        friendId: friendId,
        userId: userId,
      });
      await follower.save();
    }

    return res.status(200).json({
      message: `successfully ${alreadyFriends ? "unfriend" : "friend"} user`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

const getUserFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const matchUserObj = matchUser({ id: userId, name: "userId" });

    const friends = await Friends.aggregate([
      {
        ...matchUserObj,
      },
      {
        $lookup: {
          from: "users",
          localField: "friendId",
          foreignField: "_id",
          as: "friendData",
        },
      },
      {
        $unwind: "$friendData",
      },
      {
        $project: {
          userId: "$friendData._id",
          username: "$friendData.username",
          fullname: "$friendData.fullname",
          email: "$friendData.email",
          profileImage: "$friendData.profileImage",
          age: "$friendData.age",
          gender: "$friendData.gender",
          bio: "$friendData.bio",
          createdAt: "$friendData.createdAt",
          updatedAt: "$friendData.updatedAt",
          isVerified: "$friendData.isVerified",
          lastSeen: "$friendData.lastSeen",
          status: "$friendData.status"
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      message: "Friends fetched successfully",
      data: friends,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
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

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid password",
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

    const xionLoggedInUser = await abstraxionAuth.login(email);

    if (xionLoggedInUser) {
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
    } else {
      return res.status(400).json({
        status: "failed",
        message: "An Error Occired",
        data: null,
      });
    }
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
      const { email, token, channel, walletAddress } = req.body;

      let isTokenValid = false;

      // Check authentication method based on channel
      if (channel === "google") {
        isTokenValid = await validateGoogleToken(token, email);
      } else if (channel === "apple") {
        isTokenValid = await validateAppleToken(token, email);
      } else if (channel === "xion" || channel === "argent") {
        // For wallet-based auth, we don't need traditional token validation
        // Just check if the wallet address is provided
        isTokenValid = !!walletAddress;
      } else {
        return res.status(400).json({
          status: "failed",
          message: "Invalid authentication channel",
        });
      }

      if (!isTokenValid) {
        return res.status(400).json({
          status: "failed",
          message: "Invalid authentication credentials",
        });
      }

      // Find user based on email or wallet address
      let user;

      if (channel === "xion" || channel === "argent") {
        // Find user by wallet address
        const walletPath = channel === "xion" ? "wallets.xion.address" : "wallets.starknet.address";
        user = await User.findOne({ [walletPath]: walletAddress });
      } else {
        // Find user by email for traditional auth
        user = await User.findOne({ email });
      }

      if (!user) {
        // Create basic user object for response
        const newUserData = channel === "xion" || channel === "argent"
          ? { wallets: { [channel]: { address: walletAddress } } }
          : { email };

        return res.status(200).json({
          status: "success",
          message: "User not found. Please complete registration.",
          data: {
            user: newUserData,
            isNewUser: true,
          },
        });
      }

      // Get followed artists with details (same as original code)
      const followedArtists = await Follow.find({ follower: user._id })
        .select("following")
        .lean();

      const artistIds = followedArtists.map((f) => f.following);

      // Get complete details of followed artists (same as original code)
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

      // Existing user checks
      const isArtist = await Artist.findOne({
        userId: user._id,
        verified: true,
      });

      const hasClaim = await ArtistClaim.findOne({
        userId: user._id,
      });

      try {
        // For wallet-based auth, we don't need to call the wallet service
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

        if (user.wallets?.xion?.mnemonic) {
          // Ensure we don't expose sensitive wallet data
          userData.wallets = {
            ...userData.wallets,
            xion: {
              address: userData.wallets.xion.address,
            },
          };
        }

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

// Add track to favorites
const addToLibrary = async (req, res) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;

    if (!validator.isMongoId(id)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid ID format",
      });
    }

    let userLibrary = await Favorites.findOne({ userId });
    if (!userLibrary) {
      userLibrary = new Favorites({ userId, tracks: [], releases: [] });
    }

    // Check if ID is a track
    const track = await Track.findById(id);
    if (track) {
      const trackExists = userLibrary.tracks.some(
        (t) => t.trackId.toString() === id
      );

      if (trackExists) {
        userLibrary.tracks = userLibrary.tracks.filter(
          (t) => t.trackId.toString() !== id
        );
      } else {
        userLibrary.tracks.push({
          trackId: id,
          addedAt: new Date(),
        });
      }

      await userLibrary.save();
      return res.status(200).json({
        status: "success",
        message: trackExists
          ? "Track removed from library"
          : "Track added to library",
        data: {
          id: track._id,
          type: "track",
          addedToLibrary: !trackExists,
        },
      });
    }

    // Check if ID is a release
    const release = await Release.findById(id);
    if (release) {
      const releaseExists = userLibrary.releases.some(
        (r) => r.releaseId.toString() === id
      );

      if (releaseExists) {
        userLibrary.releases = userLibrary.releases.filter(
          (r) => r.releaseId.toString() !== id
        );
        // Also remove all tracks from this release
        const releaseTracks = await Track.find({ releaseId: id });
        const releaseTrackIds = releaseTracks.map((t) => t._id.toString());
        userLibrary.tracks = userLibrary.tracks.filter(
          (t) => !releaseTrackIds.includes(t.trackId.toString())
        );
      } else {
        userLibrary.releases.push({
          releaseId: id,
          addedAt: new Date(),
        });

        // Add all tracks from the release
        const releaseTracks = await Track.find({ releaseId: id });
        const newTracks = releaseTracks.map((track) => ({
          trackId: track._id,
          addedAt: new Date(),
        }));

        userLibrary.tracks.push(...newTracks);
      }

      await userLibrary.save();
      return res.status(200).json({
        status: "success",
        message: releaseExists
          ? "Release removed from library"
          : "Release added to library",
        data: {
          id: release._id,
          type: "release",
          addedToLibrary: !releaseExists,
        },
      });
    }

    return res.status(404).json({
      status: "failed",
      message: "No track or release found with the provided ID",
    });
  } catch (error) {
    return res.status(500).json({
      status: "failed",
      message: "Error updating library",
      error: error.message,
    });
  }
};

const getUserLibrary = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      type = "all", // 'all', 'tracks', 'releases'
      sort = "recent", // 'recent', 'name', 'artist'
    } = req.query;

    if (!validator.isMongoId(userId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid user ID",
      });
    }

    const skip = (page - 1) * limit;

    // Build sort options
    let sortOption = {};
    switch (sort) {
      case "name":
        sortOption = { name: 1 };
        break;
      case "artist":
        sortOption = { "artistId.name": 1 };
        break;
      default: // recent
        sortOption = { addedAt: -1 };
    }

    const library = await Favorites.findOne({ userId })
      .populate({
        path: "tracks.trackId",
        populate: [
          {
            path: "artistId",
            model: "artist",
            select: "name profileImage",
          },
          {
            path: "releaseId",
            model: "releases",
            select: "title coverImage type",
          },
        ],
      })
      .populate({
        path: "releases.releaseId",
        populate: {
          path: "artistId",
          model: "artist",
          select: "name profileImage",
        },
      });

    if (!library) {
      return res.status(200).json({
        status: "success",
        message: "User library is empty",
        data: {
          items: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            pages: 0,
          },
        },
      });
    }

    // Process and format the data based on type
    let items = [];
    if (type === "all" || type === "tracks") {
      const tracks = library.tracks
        .filter((track) => track.trackId && track.trackId._id)
        .map((track) => ({
          id: track.trackId._id,
          type: "track",
          title: track.trackId.title || "Unknown Title",
          duration: track.trackId.duration,
          addedAt: track.addedAt,
          artist: track.trackId.artistId
            ? {
                id: track.trackId.artistId._id,
                name: track.trackId.artistId.name || "Unknown Artist",
                image: track.trackId.artistId.profileImage,
              }
            : null,
          release: track.trackId.releaseId
            ? {
                id: track.trackId.releaseId._id,
                title: track.trackId.releaseId.title || "Unknown Release",
                image: track.trackId.releaseId.coverImage,
                type: track.trackId.releaseId.type,
              }
            : null,
        }));
      items = [...items, ...tracks];
    }

    if (type === "all" || type === "releases") {
      const releases = library.releases
        .filter((release) => release.releaseId && release.releaseId._id)
        .map((release) => ({
          id: release.releaseId._id,
          type: "release",
          title: release.releaseId.title || "Unknown Title",
          addedAt: release.addedAt,
          coverImage: release.releaseId.coverImage,
          releaseType: release.releaseId.type,
          artist: release.releaseId.artistId
            ? {
                id: release.releaseId.artistId._id,
                name: release.releaseId.artistId.name || "Unknown Artist",
                image: release.releaseId.artistId.profileImage,
              }
            : null,
        }));
      items = [...items, ...releases];
    }

    // Sort items
    items.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "artist") return a.artist.name.localeCompare(b.artist.name);
      return new Date(b.addedAt) - new Date(a.addedAt);
    });

    const total = items.length;
    const paginatedItems = items.slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved user library",
      data: {
        items: paginatedItems,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "failed",
      message: "Error fetching library",
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

    const xionAddress = user.wallets?.xion?.address;
    const starknetAddress = user.wallets?.starknet?.address;

    if (!xionAddress || !xionAddress.startsWith("xion")) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid or missing XION wallet address",
      });
    }

    // Get both XION and StarkNet balances using AbstraxionAuth
    const balanceData = await abstraxionAuth.getBalances(
      xionAddress,
      undefined,
      starknetAddress
    );

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved wallet balances",
      data: {
        xion: {
          address: xionAddress,
          balances: balanceData.cosmos,
        },
        starknet: starknetAddress
          ? {
              address: starknetAddress,
              balance: balanceData.starknet,
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

export {
  getAllUsers,
  getUser,
  getArtistUserSubcribeTo,
  createUser,
  createGenresForUser,
  getArtistBasedOnUserGenre,
  createUserFaveArtistBasedOnGenres,
  subcribeToPremium,
  subcribeToArtist,
  isUserFollowing,
  deleteUser,
  addFriend,
  getUserFriends,
  getUserByEmail,
  signIn,
  checkIfUserNameExist,
  verifyEmailOTP,
  verifyOtp,
  generateUserFeed,
  followArtist,
  getFollowedArtists,
  addToLibrary,
  getUserLibrary,
  getUserWalletBalance,
  updateUserProfile,
  resetPassword,
  requestPasswordReset
};
