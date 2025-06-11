import { starknetService } from '../services/starknet.service.js';
import dotenv from 'dotenv';
import { Account, constants, } from 'starknet';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Test StarkNet wallet creation, funding, and deployment
 */
const testStarknetWallet = async () => {
  try {
    // Test email
    const testEmail = `test-${Date.now()}@example.com`;
    console.log(`Testing with email: ${testEmail}`);

    // Step 1: Create a wallet
    console.log('\n--- Step 1: Creating wallet ---');
    const wallet = await starknetService.createUserWallet(testEmail);
    console.log('Wallet created successfully:');
    console.log('Address:', wallet.address);
    console.log('Is Deployed:', wallet.isDeployed);

    // Step 2: Deploy and fund the wallet
    console.log('\n--- Step 2: Deploying and funding wallet ---');
    try {
      // Provide funder address and private key from environment variables
      const funderAddress = "0x0620fd15e0b464c174933b5235c72a50376379ee1528719848e144385d0a1ed4";
      const funderPrivateKey = "0x05d67e95f8d5913249452a410db389110c390a36eb0e2ecb092c670ba945b8b9";
      console.log('Funder Address:', funderAddress);
      console.log('Funder Private Key:', funderPrivateKey);
      const amount = 10000000000000000000; // 0.1 ETH in wei

      if (!funderAddress || !funderPrivateKey) {
        throw new Error('Funder address or private key not provided in environment variables');
      }

      const deploymentResult = await starknetService.deployUserWallet(
        testEmail,
        funderAddress,
        funderPrivateKey,
        amount
      );
      console.log('Deployment and funding result:', deploymentResult);

      // Step 3: Test a simple transaction (optional)
      if (deploymentResult.status === 'ACCEPTED_ON_L2' || deploymentResult.status === 'ACCEPTED_ON_L1') {
        console.log('\n--- Step 3: Testing a simple transaction ---');

        // Get wallet info
        const walletInfo = await starknetService.getUserWalletInfo(testEmail);

        // Create account instance
        const account = new Account(
          starknetService.provider,
          walletInfo.address,
          walletInfo.privateKey,
          undefined,
          constants.TRANSACTION_VERSION.V3
        );

        // Execute a simple transaction (transfer a small amount of ETH back to the funder)
        const transferAmount = 1000n; // Very small amount

        // Execute transfer
        const transferResponse = await account.execute({
          contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH contract on StarkNet
          entrypoint: 'transfer',
          calldata: [
            funderAddress, // To address
            transferAmount.toString(), // Amount low
            '0' // Amount high
          ]
        });

        console.log('Transfer transaction hash:', transferResponse.transaction_hash);

        // Wait for transaction confirmation
        const transferReceipt = await starknetService.provider.waitForTransaction(transferResponse.transaction_hash);
        console.log('Transfer transaction receipt:', transferReceipt);
      }

    } catch (error) {
      console.error('Deployment and funding failed:', error);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Run the test
connectDB().then(() => {
  console.log('Starting StarkNet wallet test...');
  testStarknetWallet();
});
