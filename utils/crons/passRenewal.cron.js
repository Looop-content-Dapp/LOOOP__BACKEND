import cron from 'node-cron';
import { PassSubscription } from '../../models/passSubscription.model';
import contractHelper from '../../xion/contractConfig';

const checkPassRenewals = async () => {
  try {
    // Find all expired active passes
    const expiredPasses = await PassSubscription.find({
      status: 'active',
      expiryDate: { $lt: new Date() }
    });

    for (const pass of expiredPasses) {
      try {
        // Call smart contract to burn the NFT
        await contractHelper.burnNFTPass({
          collectionAddress: pass.contractAddress,
          tokenId: pass.tokenId
        });

        // Update subscription status
        pass.status = 'burnt';
        await pass.save();

      } catch (error) {
        console.error(`Failed to burn pass ${pass.tokenId}:`, error);
      }
    }
  } catch (error) {
    console.error('Pass renewal check failed:', error);
  }
};

// Run every day at midnight
cron.schedule('0 0 * * *', checkPassRenewals);
