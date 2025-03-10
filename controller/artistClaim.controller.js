import { Artist } from "../models/artist.model.js";
import { User } from "../models/user.model.js";
import { ArtistClaim } from "../models/artistClaim.model.js";
import mongoose from "mongoose";

export const submitArtistClaim = async (req, res) => {
  try {
    const {
      userId,
      artistId,
      verificationDocuments,
      socialMediaHandles,
      websiteUrl,
    } = req.body;

    // Validate required fields
    if (!userId || !artistId || !verificationDocuments) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["userId", "artistId", "verificationDocuments"],
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({
        message: "Artist profile not found",
      });
    }

    if (artist.verified) {
      return res.status(400).json({
        message: "This artist profile is already verified",
      });
    }

    const existingClaim = await ArtistClaim.findOne({
      artistId,
      status: "pending",
    });

    if (existingClaim) {
      return res.status(400).json({
        message: "A claim request is already pending for this artist profile",
      });
    }

    const claim = new ArtistClaim({
      userId,
      artistId,
      verificationDocuments,
      socialMediaHandles,
      websiteUrl,
    });

    await claim.save();

    return res.status(201).json({
      message: "Claim request submitted successfully",
      data: claim,
    });
  } catch (error) {
    console.error("Error in submitClaim:", error);
    return res.status(500).json({
      message: "Error submitting claim",
      error: error.message,
    });
  }
};

export const submitClaim = async ({
  userId,
  artistId,
  verificationDocuments,
  socialMediaHandles,
}) => {
  try {
    if (!userId || !verificationDocuments) {
      return {
        message: "Missing required fields",
        required: ["userId", "artistId", "verificationDocuments"],
      };
    }

    const existingClaim = await ArtistClaim.findOne({
      userId,
      status: "pending",
    });

    if (existingClaim) {
      return {
        isPending: true,
        message: "A claim request is already pending for this artist profile",
      };
    } else {
      const claim = new ArtistClaim({
        userId,
        artistId,
        verificationDocuments,
        socialMediaHandles,
        websiteUrl: verificationDocuments.websiteurl,
        status: "pending",
      });

      await claim.save();

      if (claim) {
        return {
          message: "Claim request submitted successfully",
          data: { id: claim.id, status: claim.status },
          isPending: false,
        };
      }
    }
  } catch (error) {
    console.error("Error in submitClaim:", error);
    return {
      message: "Error submitting claim",
      error: error.message,
    };
  }
};

// Get claim status
export const getClaimStatus = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await ArtistClaim.findById(claimId)
      .populate("artistId", "name email profileImage genre")
      .populate("userId", "email profileImage");

    if (!claim) {
      return res.status(400).json({
        status: "failed",
        message: "Claim request not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully retrieved claim status",
      data: {
        status: claim.status,
      },
    });
  } catch (error) {
    console.error("Error in getClaimStatus:", error);
    return res.status(500).json({
      message: "Error fetching claim status",
      error: error.message,
    });
  }
};

// Get all claims by user
export const getUserClaims = async (req, res) => {
  try {
    const { userId } = req.params;

    const claims = await ArtistClaim.find({ userId })
      .populate("artistId", "name email profileImage genre")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Successfully retrieved user claims",
      data: claims,
    });
  } catch (error) {
    console.error("Error in getUserClaims:", error);
    return res.status(500).json({
      message: "Error fetching user claims",
      error: error.message,
    });
  }
};

export const updateClaimStatus = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, rejectionReason, adminId } = req.body;

    if (
      !["approved", "rejected", "pending", "not-submitted"].includes(status)
    ) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid status. Must be 'approved', 'rejected' or 'pending'",
      });
    }

    // Validate admin role
    if (!["admin", "superAdmin"].includes(adminId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid admin. Must be 'admin' or 'superAdmin'",
      });
    }

    const claim = await ArtistClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({
        status: "failed",
        message: "Claim request not found",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update claim status
      claim.status = status;
      claim.verifiedBy = adminId;
      claim.verifiedAt = new Date();
      claim.updatedAt = new Date();

      if (status === "rejected") {
        if (!rejectionReason) {
          throw new Error(
            "Rejection reason is required when rejecting a claim"
          );
        }
        claim.rejectionReason = rejectionReason;
      }

      if (status === "approved") {
        // Update artist profile
        await Artist.findByIdAndUpdate(
          claim.artistId,
          {
            verified: true,
            verifiedAt: new Date(),
            updatedAt: new Date(),
            ...claim.socialMediaHandles,
            websiteUrl: claim.websiteUrl,
          },
          { session }
        );

        // Update user profile
        await User.findByIdAndUpdate(
          claim.userId,
          {
            artist: claim.artistId,
            updatedAt: new Date(),
          },
          { session }
        );
      }

      await claim.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      status: "success",
      message: `Claim ${status} successfully`,
      data: claim,
    });
  } catch (error) {
    console.error("Error in updateClaimStatus:", error);
    return res.status(500).json({
      message: "Error updating claim status",
      error: error.message,
    });
  }
};
