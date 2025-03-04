import { ReferralCode } from "../models/referralcode.model.js";

export const getUserReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await ReferralCode.findOne({ userId: id });

    if (!referral) {
      return res.status(404).json({ message: "Referral not found" });
    }

    return res.status(200).json({
      status: "success",
      data: referral,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching referral",
      error: error.message,
    });
  }
};
