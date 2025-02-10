import { Artist } from "../models/artist.model.js";
import { Social } from "../models/socials.model.js";
import { Subscriber } from "../models/subcriber.model.js";
import { Follow } from "../models/followers.model.js";
import { Post } from "../models/post.model.js";
import validator from "validator";
import { submitClaim } from "./artistClaim.controller.js";
import { User } from "../models/user.model.js";
import { Release } from "../models/releases.model.js";
import { Types } from "mongoose";
import { Genre } from "../models/genre.model.js";
import { Community } from "../models/community.model.js";
import { FaveArtist } from "../models/faveartist.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";
import contractHelper from "../xion/contractConfig.js";

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
    if (getGenre.length === 0) {
      return res
        .status(404)
        .json({ status: "failed", message: "error in fetching genre" });
    }
    const genreNames = getGenre.map((genre) => genre.name);
    const getArtisCommunity = await Community.findOne({
      createdBy: new Types.ObjectId(isartist._id),
    });

    const release = await Release.find(
      {
        artistId: isartist._id,
      },
      { __v: 0 }
    );
    const userHasFavouriteArtist = await FaveArtist.find({
      artistId: isartist._id,
    });
    const followers = userHasFavouriteArtist.map(
      (faveArtist) => faveArtist.userId
    );
    
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
      email,
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

    const requiredFields = {
      artistname: "Artist name is required",
      email: "Email is required",
      profileImage: "Profile image is required",
      bio: "Bio is required",
      address1: "Address 1 is required",
      country: "Country is required",
      city: "City is required",
      postalcode: "Postal code is required",
      websiteurl: "Website URL is required",
      id: "User ID is required",
    };

    const requiredSocial = {
      tiktok: "Tiktok social is required",
      instagram: "Instagram social is required",
      twitter: "Twitter social is required",
    };

    const missingFields = Object.entries({
      ...requiredFields,
      ...requiredSocial,
    })
      .filter(([field]) => !req.body[field])
      .map(([, message]) => message);

    if (missingFields.length) {
      return res.status(400).json({
        message: "Missing required fields",
        errors: missingFields,
      });
    }

    if (!validator.isMongoId(id)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const existingArtistAccount = await Artist.findOne({ userId: id });
    if (existingArtistAccount) {
      return res.status(400).json({
        status: "failed",
        message: "User already has an artist account",
      });
    }

    const existingArtist = await Artist.findOne({ email });
    if (existingArtist) {
      return res
        .status(400)
        .json({ status: "failed", message: "Artist already exists" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "invalid email" });
    }

    if (!genres || !Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        message: "Error",
        errors: "At least one genre must be specified",
      });
    }

    if (!validator.isURL(profileImage)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid profile image URL" });
    }

    if (!validator.isURL(websiteurl)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid website URL" });
    }

    if (!validator.isURL(twitter)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid Twitter URL" });
    }

    if (!validator.isURL(tiktok)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid TikTok URL" });
    }

    if (!validator.isURL(instagram)) {
      return res
        .status(400)
        .json({ status: "failed", message: "Invalid Instagram URL" });
    }

    const artist = new Artist({
      name: artistname,
      email,
      profileImage,
      biography: bio,
      genres,
      address1: address1,
      address2,
      country,
      city,
      postalcode,
      websiteurl,
      userId: id,
      artistId: user.id + Math.floor(Math.random() * 1000),
    });

    await artist.save();

    const claimresult = await submitClaim({
      verificationDocuments: {
        email,
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
        tiktok: tiktok,
        instagram: instagram,
        twitter: twitter,
      },
      artistId: artist._id,
    });

    const socials = await Social({
      artistId: artist._doc._id,
      twitter,
      tiktok,
      instagram,
    });

    await socials.save();

    const getGenre = await Genre.find({ _id: { $in: genres } });
    const genreNames = getGenre.map((genre) => genre.name);

    const artistData = { artist: { ...artist._doc, genres: genreNames } };
    delete artistData.artist.artistId;

    return res.status(200).json({
      status: "success",
      message: "Artist created successfully",
      data: { ...artistData, claimresult },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating artist", error: error.message });
  }
};

export const signContract = async (req, res) => {
  try {
    const { artistname, artistAddress, claimId } = req.body;

    const requiredFields = {
      artistname: "Artist name is required",
      artistAddress: "Artist address is required",
    };

    const missingFields = Object.entries({
      ...requiredFields,
    })
      .filter(([field]) => !req.body[field])
      .map(([, message]) => message);

    if (missingFields.length) {
      return res.status(401).json({
        message: "Missing required fields",
        errors: missingFields,
      });
    }

    const validateArtistName = await Artist.findOne({ name: artistname });

    if (validateArtistName) {
      const signContract = await contractHelper.signAgreement({
        contractAddress:
          "xion10242qq55873xumkvfm6yth0yg92z66f6uv7qnez5fzz89tk30lesqg5s2m",
        artistAddress: artistAddress,
        artistName: artistname,
      });

      if (signContract) {
        await User.findByIdAndUpdate(validateArtistName.userId, {
          artist: new Types.ObjectId(validateArtistName._id),
          updatedAt: new Date(),
        });
      }
    } else {
      return res.status(400).json({
        status: "failed",
        message: "Artist not found",
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

export const followArtist = async (req, res) => {
  try {
    const { userId, artistId } = req.params;

    const alreadySubcribed = await Follow.findOne({
      following: artistId, // get total followers for artist
      follower: userId,
    });

    console.log("follow");
    if (alreadySubcribed) {
      await Follow.deleteOne({
        following: artistId, // get total followers for artist
        follower: userId,
      });
    } else {
      const follower = new Follow({
        following: artistId, // get total followers for artist
        follower: userId,
      });
      await follower.save();
    }

    return res.status(200).json({
      message: `successfully ${
        alreadySubcribed ? "unfollowed" : "followed"
      } artist`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
      error: error.message,
    });
  }
};

export const getFollow = async (req, res) => {
  try {
    const { id } = req.params;

    const isArtist = await Artist.findOne({ _id: id });

    console.log(isArtist);
    let follow;
    if (isArtist) {
      // get artist followers
      follow = await Follow.aggregate([
        {
          $match: {
            $expr: {
              $eq: ["$following", { $toObjectId: id }],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "follower",
            foreignField: "_id",
            as: "follower",
          },
        },
        {
          $unwind: {
            path: "$follower",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            following: 0,
          },
        },
      ]);
    } else {
      // get artist following
      follow = await Follow.aggregate([
        {
          $match: {
            $expr: {
              $eq: ["$follower", { $toObjectId: id }],
            },
          },
        },
        {
          $lookup: {
            from: "artists",
            localField: "following",
            foreignField: "_id",
            as: "artist",
          },
        },
        {
          $unwind: {
            path: "$artist",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            follower: 0,
          },
        },
      ]);
    }

    return res.status(200).json({
      message: `successfully ${
        isArtist ? "gotten artist followers" : "gotten user following"
      } `,
      data: follow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error occured",
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
