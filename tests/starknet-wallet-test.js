import { starknetService } from '../services/starknet.service.js';
import dotenv from 'dotenv';
import { Account, constants, Contract, RpcProvider } from 'starknet';
import fs from 'fs';
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
 * Test StarkNet wallet creation and deployment
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

    // Step 2: Fund the wallet (for testnet)
    console.log('\n--- Step 2: Funding the wallet ---');
    console.log(`To continue, you need to fund this wallet address: ${wallet.address}`);
    console.log('You can use the Sepolia faucet: https://starknet-faucet.vercel.app/');
    console.log('After funding, press Enter to continue...');

    // Wait for user to fund the wallet
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });

    // Step 3: Deploy the wallet
    console.log('\n--- Step 3: Deploying wallet ---');
    try {
      const deploymentResult = await starknetService.deployUserWallet(testEmail);
      console.log('Deployment result:', deploymentResult);

      // Step 4: Test a simple transaction (optional)
      if (deploymentResult.status === 'ACCEPTED_ON_L2' || deploymentResult.status === 'ACCEPTED_ON_L1') {
        console.log('\n--- Step 4: Testing a simple transaction ---');

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

        // Execute a simple transaction (transfer a small amount of ETH to the prefunded account)
        const transferAmount = 1000n; // Very small amount

        // Execute transfer
        const transferResponse = await account.execute({
          contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH contract on StarkNet
          entrypoint: 'transfer',
          calldata: [
            process.env.STARKNET_PREFUNDED_ADDRESS, // To address
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
      console.error('Deployment failed:', error);
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
