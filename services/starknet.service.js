import { Provider, Contract, Account, ec, json, stark, uint256, shortString, CallData, constants, RpcProvider, hash } from 'starknet';
import dotenv from 'dotenv';
import { User } from '../models/user.model.js';
import crypto from 'crypto';
import { Wallet } from '../models/wallet.model.js';

dotenv.config();

/**
 * Service for interacting with Starknet contracts
 */
export default class StarknetService {
  constructor() {
    // Use RPC provider with the endpoint from .env or fallback to a reliable public node
    const nodeUrl = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_6/SJrfoNSORPvz7PkhNneqhqTpnielFNxS"
    console.log(`Initializing StarkNet provider with node URL: ${nodeUrl}`);

    this.provider = new RpcProvider({
      nodeUrl: nodeUrl,
      // Add retries for better reliability
      retries: 3,
      // Add a reasonable timeout
      timeout: 30000
    });
  }
//https://starknet-sepolia.public.blastapi.io
  /**
   * Initialize a contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object} abi - The contract ABI
   * @returns {Contract} - Contract instance
   */
  getContract(contractAddress, abi) {
    return new Contract(abi, contractAddress, this.provider);
  }

  /**
   * Create an account instance
   * @param {string} privateKey - The private key
   * @param {string} accountAddress - The account address
   * @returns {Account} - Account instance
   */
  getAccount(privateKey, accountAddress) {
    return new Account(this.provider, accountAddress, privateKey);
  }


  /**
   * Call a read-only method on a contract with enhanced details
   * @param {string} contractAddress - The contract address
   * @param {Object} abi - The contract ABI
   * @param {string} method - The method name
   * @param {Array} calldata - The call data
   * @returns {Promise<Object>} - The result with contract details
   */
  async callContract(contractAddress, method, calldata = []) {
    try {
      // Get contract class information
      const { abi: contractAbi } = await this.provider.getClassAt(contractAddress);

      // Create contract instance
      const contract = this.getContract(contractAddress, contractAbi);
      console.log(`Contract instance created for address ${contractAddress}`);

      // Call the method
      const result = await contract.call(method, calldata);
      console.log(`Result of calling contract method ${method}:`, result);

      // Get additional contract information
      const contractInfo = {
        address: contractAddress,
        method: method,
        result: result,
        timestamp: Date.now(),
        status: 'success'
      };

      return {
        contractInfo,
        result
      };

    } catch (error) {
      console.error(`Error calling contract method ${method}:`, error);
      return {
        contractInfo: {
          address: contractAddress,
          method: method,
          timestamp: Date.now(),
          status: 'failed',
          error: error.message
        },
        result: null
      };
    }
  }


   /**
   * Execute a transaction on a StarkNet smart contract with event handling
   * @param {string} contractAddress - The address of the target smart contract on StarkNet
   * @param {string} method - The name of the contract method to execute
   * @param {Array} calldata - Array of parameters to pass to the contract method
   * @param {Account} account - The StarkNet account that will sign and send the transaction
   * @returns {Promise<Object>} Returns an object containing:
   *   - transactionHash: The hash of the executed transaction
   *   - receipt: Complete transaction receipt with execution details
   *   - eventData: Parsed event data from the transaction (if a mint event is emitted), including:
   *     - recipientAddress: Address of the token recipient
   *     - tokenId: ID of the minted token (parsed from hex)
   *     - param: Additional parameter from the event (parsed from hex)
   *     - contractAddress: Address of the contract that emitted the event
   *     - blockNumber: Block number where the transaction was included
   *     - transactionHash: Hash of the transaction
   *     - status: Execution status of the transaction
   * @throws {Error} Throws if transaction execution fails or event parsing fails
   */
  async executeTransaction(contractAddress, method, calldata = [], account) {
    const account0 = new Account(
        this.provider,
        account.address,
        account.privateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
    );

    const { abi } = await this.provider.getClassAt(contractAddress);
    try {
      console.log("input", contractAddress, abi, method, calldata, account)
      const contract = this.getContract(contractAddress, abi);
      contract.connect(account0);
      console.log(`Contract instance created for address ${contractAddress}`);

      const myCall = contract.populate(method, calldata);
      const res = await contract[method](myCall.calldata);
      console.log(`Transaction for method ${method} executed with hash:`, res);
      const receipt = await this.provider.waitForTransaction(res.transaction_hash);
      console.log(`Transaction receipt for method ${method}:`, receipt);

        // Extract relevant data from the mint event (second event in the array)
        const mintEvent = receipt.events[1];
        const eventData = {
          recipientAddress: mintEvent.data[0],  // recipient address
          tokenId: parseInt(mintEvent.data[1], 16),  // token ID as number
          param: parseInt(mintEvent.data[2], 16),  // additional parameter as number
          contractAddress: mintEvent.from_address,  // contract that emitted the event
          blockNumber: receipt.block_number,
          transactionHash: receipt.transaction_hash,
          status: receipt.execution_status
        };

      return {
        transactionHash: res.transaction_hash,
        receipt,
        eventData,
        mintEvent
      };
    } catch (error) {
      console.error(`Error executing transaction for method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param {string} txHash - The transaction hash
   * @returns {Promise<any>} - The transaction status
   */
  async getTransactionStatus(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      return tx;
    } catch (error) {
      console.error(`Error getting transaction status for ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   * @param {string} txHash - The transaction hash
   * @returns {Promise<any>} - The transaction receipt
   */
  async getTransactionReceipt(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error(`Error getting transaction receipt for ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Get block information
   * @param {string|number} blockIdentifier - Block hash or number
   * @returns {Promise<any>} - Block information
   */
  async getBlock(blockIdentifier) {
    try {
      const block = await this.provider.getBlock(blockIdentifier);
      return block;
    } catch (error) {
      console.error(`Error getting block ${blockIdentifier}:`, error);
      throw error;
    }
  }

  /**
   * Generate a new key pair
   * @returns {Object} - The key pair
   */
  generateKeyPair() {
    try {
      // // Method 1: For newer versions of starknet.js
      // if (typeof ec.starkCurve !== 'undefined') {
      //   const privateKey = `0x${ec.starkCurve.randomPrivateKey().toString('hex')}`;
      //   const publicKey = ec.starkCurve.getStarkKey(privateKey);
      //   return { privateKey, publicKey };
      // }
      // Method 2: For older versions using getKeyPair
      if (typeof ec.getKeyPair === 'function') {
        const privateKey = stark.randomAddress();
        const keyPair = ec.getKeyPair(privateKey);
        const publicKey = ec.getStarkKey(keyPair);
        return { privateKey, publicKey };
      }

      // Add fallback method if neither condition is met
      throw new Error('No compatible method found to generate key pair');
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  /**
   * Convert a string to felt (field element)
   * @param {string} str - The string to convert
   * @returns {string} - The felt representation
   */
  stringToFelt(str) {
    return shortString.encodeShortString(str);
  }

  /**
   * Convert a felt to string
   * @param {string} felt - The felt to convert
   * @returns {string} - The string representation
   */
  feltToString(felt) {
    return shortString.decodeShortString(felt);
  }

  /**
   * Parse uint256 value
   * @param {Object} uint256Value - The uint256 value from contract
   * @returns {string} - The parsed value as string
   */
  parseUint256(uint256Value) {
    return uint256.uint256ToBN(uint256Value).toString();
  }

  /**
   * Create a Starknet wallet for a user with encrypted storage
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} - The wallet information
   */
  async createUserWallet(email) {
    try {
      // Check if user already has a wallet
      let wallet = await Wallet.findOne({ email });

      if (wallet?.starknet?.encryptedPrivateKey) {
        // Return existing wallet if it has encryption data
        const decryptedPrivateKey = this.decryptPrivateKey(
          wallet.starknet.encryptedPrivateKey,
          wallet.starknet.iv,
          wallet.starknet.salt
        );
        return {
          address: wallet.starknet.address,
          privateKey: decryptedPrivateKey,
          isDeployed: wallet.starknet.isDeployed || false
        };
      }

      // Using Open Zeppelin account contract v0.8.1
      const OZaccountClassHash = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';

      // Generate public and private key pair
      const privateKey = stark.randomAddress();
      console.log('New OZ account:\nprivateKey=', privateKey);
      const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
      console.log('publicKey=', starkKeyPub);

      // Calculate future address of the account
      const constructorCallData = CallData.compile({ publicKey: starkKeyPub });
      const contractAddress = hash.calculateContractAddressFromHash(
        starkKeyPub,
        OZaccountClassHash,
        constructorCallData,
        0 // Address salt is 0 for OZ accounts
      );
      console.log('Precalculated account address=', contractAddress);

      // Encrypt private key
      const { encrypted: encryptedPrivateKey, iv, salt } = this.encryptPrivateKey(privateKey);

      // Create or update wallet
      if (!wallet) {
        wallet = new Wallet({ email });
      }

      wallet.starknet = {
        address: contractAddress,
        encryptedPrivateKey,
        iv,
        salt,
        isDeployed: false,
        constructorCalldata: constructorCallData,
        addressSalt: starkKeyPub,
        classHash: OZaccountClassHash
      };

      await wallet.save();

      console.log('Starknet wallet saved successfully:', {
        email,
        address: contractAddress,
        hasEncryptedKey: !!encryptedPrivateKey,
        hasIv: !!iv,
        hasSalt: !!salt
      });

      return {
        address: contractAddress,
        privateKey,
        isDeployed: false
      };
    } catch (error) {
      console.error('Error creating Starknet wallet for user:', error);
      throw error;
    }
  }

  /**
   * Deploy a previously created Starknet wallet
   * @param {string} email - The user's email
   * @returns {Promise<Object>} - The deployment result
   */
  async deployUserWallet(email) {
    try {
      const wallet = await Wallet.findOne({ email });
      if (!wallet?.starknet) {
        throw new Error('No Starknet wallet found for user');
      }

      if (wallet.starknet.isDeployed) {
        return {
          address: wallet.starknet.address,
          message: 'Wallet already deployed'
        };
      }
      console.log("Wallet data:", wallet.starknet);

      // Decrypt the private key
      const privateKey = this.decryptPrivateKey(
        wallet.starknet.encryptedPrivateKey,
        wallet.starknet.iv,
        wallet.starknet.salt
      );
      console.log("Decrypted private key successfully");

      // Verify provider connection before proceeding
      try {
        const chainId = await this.provider.getChainId();
        console.log(`Connected to StarkNet network with chain ID: ${chainId}`);
      } catch (networkError) {
        console.error('StarkNet provider connection failed:', networkError);
        throw new Error(`Failed to connect to StarkNet network: ${networkError.message}. Please check your network connection and RPC endpoint.`);
      }

      // Create a prefunded account to pay for deployment
      // In production, this should be a secure account with funds
      // For testing, we'll use a predefined account with funds
      const prefundedAccount = new Account(
        this.provider,
        process.env.STARKNET_PREFUNDED_ADDRESS,
        process.env.STARKNET_PREFUNDED_PRIVATE_KEY,
        undefined,
        constants.TRANSACTION_VERSION.V3
      );

      // Verify the prefunded account has funds
      try {
        // Use call method to get balance from ETH contract
        const ethContractAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'; // ETH contract on StarkNet
        const { abi } = await this.provider.getClassAt(ethContractAddress);
        const ethContract = new Contract(abi, ethContractAddress, this.provider);

        try {
          const result = await ethContract.call('balanceOf', [process.env.STARKNET_PREFUNDED_ADDRESS]);
          console.log(`Prefunded account balance result:`, result);

          if (result && result.balance && result.balance.low === 0n) {
            console.warn('Warning: Prefunded account may have zero balance. Deployment might fail.');
          }
        } catch (innerError) {
          console.error('Error calling balanceOf:', innerError);
        }
      } catch (balanceError) {
        console.error('Failed to check prefunded account balance:', balanceError);
        // Continue anyway as this might not be critical
      }

      // Deploy the account using the Universal Deployer Contract (UDC)
      let deploymentResult;
      try {
        console.log('Starting account deployment using UDC approach');

        // Get the public key from constructor calldata
        const publicKey = wallet.starknet.constructorCalldata[0];

        // Replace the public key formatting section with:
        let formattedPublicKey = publicKey;
        if (typeof publicKey === 'string') {
          formattedPublicKey = publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`;
        } else {
          formattedPublicKey = `0x${BigInt(publicKey).toString(16).padStart(64, '0')}`;
        }

        console.log('Formatted public key for constructor calldata:', formattedPublicKey);

        // Use the UDC to deploy the contract
        // The UDC address is the same on all StarkNet networks
        const UDC_ADDRESS = '0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd77666661ad02bf';

        // Prepare the deployment transaction
        const deployTx = {
          contractAddress: UDC_ADDRESS,
          entrypoint: 'deployContract',
          calldata: [
            wallet.starknet.classHash,
            wallet.starknet.addressSalt,
            '0x1',
            formattedPublicKey
          ],
          maxFee: '0x1000000000000000',
          // Add these resource bounds
          resourceBounds: {
            maxFee: '0x1000000000000000',
            maxPricePerUnit: '0x1000000000000000'
          }
        };

        console.log('Using UDC for deployment with payload:', deployTx);

        // Execute the deployment transaction
        const { transaction_hash } = await prefundedAccount.execute(deployTx);
        console.log('Account deployment transaction hash via UDC:', transaction_hash);

        // Set the deployment result
        deploymentResult = {
          transaction_hash,
          contract_address: wallet.starknet.address
        };

        // Wait for transaction to be confirmed
        console.log('Waiting for deployment transaction to be confirmed...');
        const txReceipt = await this.provider.waitForTransaction(transaction_hash, {
          retryInterval: 2000,
          maxRetries: 15
        });
        console.log('Deployment transaction receipt:', txReceipt);

        // Update wallet deployment status
        wallet.starknet.isDeployed = true;
        await wallet.save();

        return {
          address: wallet.starknet.address,
          transactionHash: transaction_hash,
          status: txReceipt?.status || 'ACCEPTED_ON_L2',
          message: 'Wallet deployment completed successfully'
        };
      } catch (deployError) {
        console.error('Account deployment failed:', deployError);

        // Try alternative approach with direct deployAccount
        try {
          console.log('Trying alternative deployment method...');

          // Create a temporary account instance for the wallet being deployed
          const accountToBeDeployed = new Account(
            this.provider,
            wallet.starknet.address,
            privateKey,
            undefined,
            constants.TRANSACTION_VERSION.V3
          );

          // Get the public key from the wallet
          const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
          console.log('Derived public key from private key:', starkKeyPub);

          // Prepare constructor calldata with the correct public key
          const constructorCalldata = CallData.compile({ publicKey: starkKeyPub });
          console.log('Compiled constructor calldata:', constructorCalldata);

          // Prepare the deployment payload
          const deployAccountPayload = {
            classHash: wallet.starknet.classHash,
            constructorCalldata: constructorCalldata,
            addressSalt: starkKeyPub,
            contractAddress: wallet.starknet.address
          };

          console.log('Using direct deploy account payload:', deployAccountPayload);

          // Deploy the account
          const { transaction_hash, contract_address } = await accountToBeDeployed.deployAccount(deployAccountPayload);
          console.log('Account deployment transaction hash:', transaction_hash);

          // Wait for transaction to be confirmed
          const txReceipt = await this.provider.waitForTransaction(transaction_hash, {
            retryInterval: 2000,
            maxRetries: 15
          });
          console.log('Deployment transaction receipt:', txReceipt);

          // Update wallet deployment status
          wallet.starknet.isDeployed = true;
          await wallet.save();

          return {
            address: contract_address || wallet.starknet.address,
            transactionHash: transaction_hash,
            status: txReceipt?.status || 'ACCEPTED_ON_L2',
            message: 'Wallet deployment completed successfully'
          };
        } catch (alternativeError) {
          console.error('Alternative deployment method also failed:', alternativeError);

          // If both methods fail, throw an error
          throw new Error(`Failed to deploy account: ${deployError.message}. Alternative method also failed: ${alternativeError.message}. This could be due to network issues, insufficient funds, or incompatible RPC endpoint.`);
        }
      }
    } catch (error) {
      console.error('Error deploying Starknet wallet:', error);
      throw error;
    }
  }

  /**
   * Encrypt a private key
   * @param {string} privateKey - The private key to encrypt
   * @returns {Object} - The encryption result
   */
  encryptPrivateKey(privateKey) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(
      process.env.SERVER_SECRET || 'your-secret-key',
      salt,
      100000,
      32,
      'sha256'
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Decrypt a private key
   * @param {string} encrypted - The encrypted private key
   * @param {string} iv - The initialization vector
   * @param {string} salt - The salt used in encryption
   * @returns {string} - The decrypted private key
   */
  decryptPrivateKey(encrypted, iv, salt) {
    // Add validation for required parameters
    if (!encrypted || !iv || !salt) {
      throw new Error('Missing required parameters for decryption');
    }

    const saltBuffer = Buffer.from(salt, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const key = crypto.pbkdf2Sync(
      process.env.SERVER_SECRET || 'your-secret-key',
      saltBuffer,
      100000,
      32,
      'sha256'
    );
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get comprehensive transaction details by hashopen
   * @param {string} txHash - The transaction hash
   * @returns {Promise<Object>} - Complete transaction details
   */
  async getTransactionDetails(txHash) {
    try {
      // Get transaction data
      const transaction = await this.provider.getTransaction(txHash);

      // Get receipt data
      const receipt = await this.provider.getTransactionReceipt(txHash);

      // Get block information if transaction is included in a block
      let blockInfo = null;
      if (transaction.block_number) {
        blockInfo = await this.provider.getBlock(transaction.block_number);
      }

      // Combine all information into a comprehensive response
      return {
        transaction,
        receipt,
        blockInfo,
        status: receipt.status,
        executionStatus: receipt.execution_status,
        finalityStatus: receipt.finality_status,
        timestamp: blockInfo ? blockInfo.timestamp : null,
        events: receipt.events || [],
      };
    } catch (error) {
      console.error(`Error getting transaction details for ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt user's wallet information
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} - The wallet information including address and decrypted private key
   */
  async getUserWalletInfo(email) {
    try {
      const wallet = await Wallet.findOne({ email });
      console.log('Wallet found:', !!wallet);
      console.log('Wallet starknet data:', wallet?.starknet);

      if (!wallet) {
        throw new Error('No wallet found for user');
      }

      if (!wallet?.starknet) {
        throw new Error('No Starknet wallet found for user');
      }

      const starknetWallet = wallet.starknet;
      console.log('Starknet wallet data:', {
        hasAddress: !!starknetWallet.address,
        hasEncryptedPrivateKey: !!starknetWallet.encryptedPrivateKey,
        hasIv: !!starknetWallet.iv,
        hasSalt: !!starknetWallet.salt,
        isDeployed: starknetWallet.isDeployed
      });

      // Check if encryption data exists
      if (!starknetWallet.encryptedPrivateKey || !starknetWallet.iv || !starknetWallet.salt) {
        throw new Error('Wallet encryption data is missing. Please recreate the wallet.');
      }

      const decryptedPrivateKey = this.decryptPrivateKey(
        starknetWallet.encryptedPrivateKey,
        starknetWallet.iv,
        starknetWallet.salt
      );

      return {
        address: starknetWallet.address,
        privateKey: decryptedPrivateKey,
        isDeployed: starknetWallet.isDeployed || false
      };
    } catch (error) {
      console.error('Error retrieving wallet information:', error);
      throw error;
    }
  }
}

export const starknetService = new StarknetService();
