import { COINGECKO_API_URL } from "../config/env.js";
// import {Starknet} from 'starknet'

class BlockchainService {
  async calculateUSDC(amount) {
    console.log('starting convertion...')
    try {
      const response = await axios.get(COINGECKO_API_URL, {
        params: {
          ids: "usd-coin",
          vs_currencies: "ngn",
        },
      });

      const ngnToUsdcRate = 1 / response.data["usd-coin"].ngn; // Inverse to get NGN → USDC rate
      res.json({
        rate: ngnToUsdcRate,
        message: `1 NGN = ${ngnToUsdcRate} USDC`,
      });

      console.log('convertion =', ngnToUsdcRate)
    } catch (error) {
      res
        .status(500)
        .json({ error: "Conversion failed", details: error.message });
    } 
    return amount * 1.0; // 1 USD = 1 USDC for simplicity
  }

//   async generateClaimToken(transactionId, usdcAmount) {
//     // Mock StarkNet interaction
//     const starknet = new Starknet(); // Initialize StarkNet provider
//     const tx = await starknet.contract.call("mintClaimToken", [
//       transactionId,
//       usdcAmount,
//     ]);
//     console.log('Token minted!')
//     return tx.hash; // Claim token hash
//   }

  async burnNFT(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription.nftTokenId) {
      const starknet = new Starknet();
      await starknet.contract.call("burnNFT", [subscription.nftTokenId]);
      subscription.nftTokenId = null;
      await subscription.save();
    }
  }
}

export default new BlockchainService();
