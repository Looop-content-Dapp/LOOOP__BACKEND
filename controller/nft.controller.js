import { User } from "../models/user.model.js";
import AbstraxionAuth from "../xion/AbstraxionAuth.js";

const abstraxionAuth = new AbstraxionAuth();

// Controller to get NFT details for a user
export const getUserNFTDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user and their NFT contracts
    const user = await User.findById(userId)
      .select('nftContracts')
      .populate('nftContracts.communityId');

    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found"
      });
    }

    // Extract contract addresses
    const contractAddresses = user.nftContracts.map(nft => nft.contractAddress);

    if (contractAddresses.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "User has no NFTs",
        data: []
      });
    }

    // Get NFT details using AbstraxionAuth
    const nftDetails = await abstraxionAuth.getNFTDetailsByContracts(contractAddresses);

    // Combine NFT details with community information
    const enrichedNFTDetails = nftDetails.data.map(nftDetail => {
      const userNFT = user.nftContracts.find(
        nft => nft.contractAddress === nftDetail.contractAddress
      );
      return {
        ...nftDetail,
        community: userNFT?.communityId,
        mintedAt: userNFT?.mintedAt
      };
    });

    return res.status(200).json({
      status: "success",
      message: "NFT details retrieved successfully",
      data: enrichedNFTDetails,
      timestamp: nftDetails.timestamp
    });

  } catch (error) {
    console.error("Error in getUserNFTDetails:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error fetching NFT details",
      error: error.message
    });
  }
};
