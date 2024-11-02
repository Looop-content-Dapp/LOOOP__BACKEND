const Artist = require("../models/artist.model");
const User = require("../models/user.model");
const ArtistClaim = require("../models/artistClaim.model");

// Submit a claim request
const submitClaim = async (req, res) => {
  try {
    const {
      userId,
      artistId,
      verificationDocuments,
      socialMediaHandles,
      websiteUrl
    } = req.body;

    // Validate required fields
    if (!userId || !artistId || !verificationDocuments) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["userId", "artistId", "verificationDocuments"]
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if artist profile exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({
        message: "Artist profile not found"
      });
    }

    // Check if artist is already verified
    if (artist.verified) {
      return res.status(400).json({
        message: "This artist profile is already verified"
      });
    }

    // Check if there's already a pending claim
    const existingClaim = await ArtistClaim.findOne({
      artistId,
      status: "pending"
    });

    if (existingClaim) {
      return res.status(400).json({
        message: "A claim request is already pending for this artist profile"
      });
    }

    // Create new claim
    const claim = new ArtistClaim({
      userId,
      artistId,
      verificationDocuments,
      socialMediaHandles,
      websiteUrl
    });

    await claim.save();

    return res.status(201).json({
      message: "Claim request submitted successfully",
      data: claim
    });
  } catch (error) {
    console.error("Error in submitClaim:", error);
    return res.status(500).json({
      message: "Error submitting claim",
      error: error.message
    });
  }
};

// Get claim status
const getClaimStatus = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await ArtistClaim.findById(claimId)
      .populate('artistId', 'name email profileImage genre')
      .populate('userId', 'email profileImage');

    if (!claim) {
      return res.status(404).json({
        message: "Claim request not found"
      });
    }

    return res.status(200).json({
      message: "Successfully retrieved claim status",
      data: claim
    });
  } catch (error) {
    console.error("Error in getClaimStatus:", error);
    return res.status(500).json({
      message: "Error fetching claim status",
      error: error.message
    });
  }
};

// Get all claims by user
const getUserClaims = async (req, res) => {
  try {
    const { userId } = req.params;

    const claims = await ArtistClaim.find({ userId })
      .populate('artistId', 'name email profileImage genre')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Successfully retrieved user claims",
      data: claims
    });
  } catch (error) {
    console.error("Error in getUserClaims:", error);
    return res.status(500).json({
      message: "Error fetching user claims",
      error: error.message
    });
  }
};

// Update claim (for admin)
const updateClaimStatus = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, rejectionReason, adminId } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be 'approved' or 'rejected'"
      });
    }

    const claim = await ArtistClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({
        message: "Claim request not found"
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update claim status
      claim.status = status;
      claim.verifiedBy = adminId;
      claim.verifiedAt = new Date();
      if (status === "rejected") {
        claim.rejectionReason = rejectionReason;
      }

      // If approved, update artist verification status
      if (status === "approved") {
        await Artist.findByIdAndUpdate(
          claim.artistId,
          {
            verified: true,
            verifiedAt: new Date(),
            ...claim.socialMediaHandles,
            websiteUrl: claim.websiteUrl
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
      message: `Claim ${status} successfully`,
      data: claim
    });
  } catch (error) {
    console.error("Error in updateClaimStatus:", error);
    return res.status(500).json({
      message: "Error updating claim status",
      error: error.message
    });
  }
};

module.exports = {
  submitClaim,
  getClaimStatus,
  getUserClaims,
  updateClaimStatus
};
