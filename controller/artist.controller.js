import { Artist } from "../models/artist.model.js";
import { Social } from "../models/socials.model.js";
import { Subscriber } from "../models/subcriber.model.js";
import { Follow } from "../models/followers.model.js";
import { Post } from "../models/post.model.js";
import validator from "validator";
import { submitClaim } from "./artistClaim.controller.js";
import { User } from "../models/user.model.js";
import { Release } from "../models/releases.model.js";
import { get, Types } from "mongoose";
import { Genre } from "../models/genre.model.js";
import { Community } from "../models/community.model.js";
import { FaveArtist } from "../models/faveartist.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import {
  createArtistSchema,
  signContractSchema,
} from "../validations_schemas/artist.validation.js";
import sendEmail from "../script.cjs";
import AbstraxionAuth from "../xion/abstraxionauth.cjs";
import { ArtistClaim } from "../models/artistClaim.model.js";

export const getAllArtists = async (req, res) => {
  try {
    const Artists = await Artist.find({});
    const populatedArtists = await Promise.all(
      Artists.map(async (artist) => {
        const genres = await Genre.find({ _id: { $in: artist.genres } });
        const genreNames = genres.map((genre) => genre.name);

        const community = await Community.findOne({ createdBy: artist._id });

        const releases = await Release.find(
          { artistId: artist._id },
          { __v: 0 }
        );

        const faveArtists = await FaveArtist.find({ artistId: artist._id });
        const followers = faveArtists.map((faveArtist) => faveArtist.userId);

        const getCommunityMembers = await CommunityMember.find({
          communityId: community?._id,
        });

        const communityMembers = getCommunityMembers.map((g) => g.userId);

        return {
          ...artist._doc,
          genres: genreNames,
          releases,
          followers,
          community: community?._id,
          communityMembers: communityMembers,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      message: "Successfully fetched all artists",
      data: populatedArtists,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching Artists", error: error.message });
  }
};

export const getArtist = async (req, res) => {
  const { id } = req.params;
  try {
    if (!validator.isMongoId(id)) {
      return res.status(400).json({ status: "failed", message: "Invalid ID" });
    }

    const isartist = await Artist.findOne(
      {
        _id: id,
      },
      { __v: 0 }
    );

    if (isartist === null) {
      return res
        .status(404)
        .json({ status: "failed", message: "Artist not found" });
    }

    const getGenre = await Genre.find({ _id: { $in: isartist.genres } });
    const genreNames =
      getGenre.length > 0 ? getGenre.map((genre) => genre.name) : [];

    const getArtisCommunity = await Community.findOne({
      createdBy: new Types.ObjectId(isartist._id),
    });

    const release = await Release.find(
      {
        artistId: isartist._id,
      },
      { __v: 0 }
    );

    // Get followers using aggregation
    const followersData = await Follow.aggregate([
      {
        $match: {
          following: new Types.ObjectId(isartist._id)
        }
      },
      {
        $group: {
          _id: null,
          followers: { $push: "$follower" }
        }
      }
    ]);

    const followers = followersData.length > 0 ? followersData[0].followers : [];

    const getCommunityMembers = await CommunityMember.find({
      communityId: getArtisCommunity?._id,
    });
    const communityMembers = getCommunityMembers.map((g) => g.userId);

    const artistData = {
      artist: {
        ...isartist._doc,
        genres: genreNames,
        releases: release,
        followers,
        community: getArtisCommunity?.id || null,
        communityMembers: communityMembers,
      },
    };
    delete artistData.artist.artistId;

    return res.status(200).json({
      status: "success",
      message: "Artist fetched successfully",
      data: {
        ...artistData,
      },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching artist", error: error.message });
  }
};

export const createArtist = async (req, res) => {
  try {
    const {
      artistname,
      profileImage,
      bio,
      genres,
      twitter,
      tiktok,
      instagram,
      address1,
      address2,
      country,
      city,
      postalcode,
      websiteurl,
      id,
    } = req.body;

    await createArtistSchema.validate(req.body, { abortEarly: false });

    if (!validator.isMongoId(id)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid MongoID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Check if user already has a pending claim
    const existingUserClaim = await ArtistClaim.findOne({
      userId: id,
      status: "pending",
    });

    if (existingUserClaim) {
      return res.status(400).json({
        status: "failed",
        message: "You already have a pending artist claim",
      });
    }

    // Check if artist profile exists by name and email
    let artist = await Artist.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${artistname}$`, 'i') } },
        { email: user.email.toLowerCase() }
      ]
    });

    let isNewArtist = false;

    // If artist doesn't exist, create new profile
    if (!artist) {
      isNewArtist = true;
      artist = new Artist({
        name: artistname,
        email: user.email.toLowerCase(),
        profileImage,
        biography: bio,
        genres,
        address1,
        address2,
        country,
        city,
        postalcode,
        websiteurl,
        verified: false,
        artistId: user.id + Math.floor(Math.random() * 1000),
      });

      await artist.save();

      // Create social media links
      const socials = new Social({
        artistId: artist._id,
        twitter,
        tiktok,
        instagram,
      });

      await socials.save();
    }

    // Create claim request
    const claimResult = await submitClaim({
      verificationDocuments: {
        email: user.email,
        profileImage,
        genres,
        address1,
        country,
        city,
        postalcode,
        websiteurl,
      },
      userId: user.id,
      socialMediaHandles: {
        tiktok,
        instagram,
        twitter,
      },
      artistId: artist._id,
    });

    await Artist.findByIdAndUpdate(artist._id, {
        claimStatus: claimResult.data.status
    });

    // Get genre names for response
    const getGenre = await Genre.find({ _id: { $in: genres } });
    const genreNames = getGenre.map((genre) => genre.name);

    const artistData = {
      artist: {
        ...artist._doc,
        genres: genreNames,
        isNewProfile: isNewArtist
      }
    };
    delete artistData.artist.artistId;

    // Send email notification
    await sendEmail(user.email, "Artist Profile Claim Request", "artist", {
      artist_name: artistname,
      support_email: "official@looopmusic.com",
    });

    return res.status(200).json({
      status: "success",
      message: isNewArtist
        ? "Artist profile created and claim submitted successfully"
        : "Claim request submitted for existing artist profile",
      data: { ...artistData, claimResult },
    });
  } catch (error) {
    console.error("Error in createArtist:", error);
    return res
      .status(500)
      .json({ message: "Error processing artist request", error: error.message });
  }
};


export const signContract = async (req, res) => {
    try {
      const { userId } = req.body;
      await signContractSchema.validate(req.body);

      // Find user and validate
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: "failed",
          message: "User not found"
        });
      }

      // Find artist by user email
      const artist = await Artist.findOne({ email: user.email });
      if (!artist) {
        return res.status(404).json({
          status: "failed",
          message: "Artist profile not found for this user"
        });
      }

      const msg = {
        sign_agreement: {
          artist_address: user.walletAddress,
          artist_name: artist.name,
        },
      };

      await AbstraxionAuth.login(user.email);
      const sign = await AbstraxionAuth.executeSmartContract(
        "xion1wpyzctmpz605z3kyjvl9q2hccdd5v285c872d9cdlau2vhywpzrsvsgun4",
        msg,
        undefined
      );

      if (sign) {
        await User.findByIdAndUpdate(userId, {
          artist: new Types.ObjectId(artist._id),
          updatedAt: new Date(),
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Contract created & signed successfully",
        data: null,
      });
    } catch (error) {
      console.log(error);
      const customerror = `Artist has already signed the agreement`;
      return res.status(500).json({
        status: "failed",
        message: "Error creating artist",
        error: error.message.includes(customerror)
          ? "Artist have already signed the contract agreement"
          : error.message,
      });
    }
};


export const verifyArtistEmail = async (req, res) => {
  try {
    const { email = "", name = "" } = req.body;

    if (email) {
      if (!validator.isEmail(email)) {
        return res.status(401).json({ message: "invalid email" });
      }

      const existingEmail = await Artist.findOne({
        email: email.toLowerCase(),
      });
      if (existingEmail) {
        return res.status(409).json({
          status: "failed",
          message: "This email is already registered as an artist",
          exists: true,
        });
      } else {
        return res.status(200).json({
          status: "success",
          message: "Email is available",
          exists: false,
        });
      }
    }

    if (name) {
      const existingName = await Artist.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
      });
      if (existingName) {
        return res.status(409).json({
          status: "failed",
          message: "This name is already registered as an artist",
          exist: true,
        });
      } else {
        return res.status(200).json({
          status: "success",
          message: "Name is available",
          exists: false,
        });
      }
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error verifying artist", error: error.message });
  }
};


export const getArtistSubcribers = async (req, res) => {
  try {
    const { artistId } = req.params;

    const subcribers = await Subscriber.find({
      artistId: artistId,
    });

    return res.status(200).json({
      message: `successfully gotten data`,
      subcribers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "could not get data",
      error: error.message,
    });
  }
};


export const getArtistPost = async (req, res) => {
  try {
    const { artistId } = req.params;

    const artistPost = await Post.find({ artistId: artistId });

    return res.status(200).json({
      message: `success`,
      posts: artistPost,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};
