import { Artist } from "../../models/artist.model.js";
import validator from "validator";
import { ArtistClaim } from "../../models/artistClaim.model.js";
import { Types } from "mongoose";
import { User } from "../../models/user.model.js";

export const updateClaimStatus = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, rejectionReason, adminId } = req.body;

    if (!validator.isMongoId(claimId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid claim ID",
      });
    }

    if (
      !["approved", "rejected", "pending", "not-submitted"].includes(status)
    ) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid status. Must be 'approved', 'rejected' or 'pending'",
      });
    }

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

    claim.status = status;
    claim.verifiedBy = adminId;
    claim.verifiedAt = new Date();
    claim.updatedAt = new Date();

    if (status === "rejected") {
      if (!rejectionReason) {
        return res.status(400).json({
          status: "failed",
          message: "Rejection reason is required when rejecting a claim",
        });
      }
      claim.rejectionReason = rejectionReason;
    }

    if (status === "approved") {
      await Artist.findByIdAndUpdate(new Types.ObjectId(claim.artistId), {
        verified: true,
        verifiedAt: new Date(),
        updatedAt: new Date(),
        ...claim.socialMediaHandles,
        websiteUrl: claim.websiteUrl,
      });

      await User.findByIdAndUpdate(claim.userId, {
        artist: new Types.ObjectId(claim.artistId),
        updatedAt: new Date(),
      });
    }

    await claim.save();

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
