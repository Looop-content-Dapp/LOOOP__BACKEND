import { HermesClient } from "@pythnetwork/hermes-client";
import crypto from "crypto";
import dotenv from "dotenv";
import {
  Account,
  CallData,
  constants,
  Contract,
  ec,
  hash,
  RpcProvider,
  shortString,
  stark,
  uint256,
} from "starknet";
import { factoryAbi } from "../Abis/factory_abi.js";
import { usdcAbi } from "../Abis/usdc_abi.js";
import { Wallet } from "../models/wallet.model.js";
import { erc20 } from "../Abis/erc20abi.js";

dotenv.config();

/**
 * Service for interacting with Starknet contracts
 */
export default class StarknetService {
  constructor() {
    const nodeUrl =
      "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_6/SJrfoNSORPvz7PkhNneqhqTpnielFNxS";
    console.log(`Initializing StarkNet provider with node URL: ${nodeUrl}`);

    this.provider = new RpcProvider({
      nodeUrl: nodeUrl,
      retries: 1,
      timeout: 30000,
    });
    this.Factory =
      "0x030255a55da8ffefb1794bfb6896c4909f67c13de2a3c8226c763d37c288c9a9";
    this.hermesClient = new HermesClient("https://hermes.pyth.network", {});
    this.usdcPriceId =
      "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
    this.USDC_ABI = [
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "felt" }],
        outputs: [{ name: "balance", type: "Uint256" }],
        stateMutability: "view",
      },
    ];
  }

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

  stringToByteArray(str) {
    // This will split the string into 31-byte chunks and convert each to a felt
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const felts = [];
    for (let i = 0; i < bytes.length; i += 31) {
      const chunk = bytes.slice(i, i + 31);
      let felt = 0n;
      for (let j = 0; j < chunk.length; j++) {
        felt = (felt << 8n) + BigInt(chunk[j]);
      }
      felts.push("0x" + felt.toString(16));
    }
    return {
      data: felts,
      pending_word: "0",
      pending_word_len: "0",
    };
  }

  /**
   * Call a read-only method on a contract
   * @param {string} contractAddress - The cxontract address
   * @param {string} method - The method name
   * @param {Array} calldata - The call data
   * @returns {Promise<Object>} - The result with contract details
   */
  async callContract(contractAddress, method, calldata = []) {
    try {
      const { abi: contractAbi } = await this.provider.getClassAt(
        contractAddress
      );
      const contract = this.getContract(contractAddress, contractAbi);
      console.log(`Contract instance created for address ${contractAddress}`);

      const result = await contract.call(method, calldata);
      console.log(`Result of calling contract method ${method}:`, result);

      return {
        contractInfo: {
          address: contractAddress,
          method: method,
          result: result,
          timestamp: Date.now(),
          status: "success",
        },
        result,
      };
    } catch (error) {
      console.error(`Error calling contract method ${method}:`, error);
      return {
        contractInfo: {
          address: contractAddress,
          method: method,
          timestamp: Date.now(),
          status: "failed",
          error: error.message,
        },
        result: null,
      };
    }
  }

  /**
   * Create a collection by retrieving the user's wallet using email
   * @param {string} email - The user's email address
   * @param {Array} calldata - The calldata for the transaction
   * @returns {Promise<Object>} - Transaction result
   */
  async executeCreateCollection(email, calldata) {
    // Retrieve and decrypt the user's wallet
    const account = await this.getUserWalletInfo(email);
    console.log("account", account);
    const account0 = new Account(
      this.provider,
      account.address,
      account.privateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );
    try {
      const contract = this.getContract(this.Factory, factoryAbi);
      contract.connect(account0);
      console.log(`Contract instance created for address ${this.Factory}`);

      // const processedCalldata = {};
      // console.log("processedCalldata", processedCalldata);

      const myCall = contract.populate("create_collection", [
        account.address,
        calldata.collectibleName, // Short string, should work
        calldata.communitySymbol, // Short string, should work
        calldata.collectibleName,
      ]);

      const res = await contract.create_collection(myCall.calldata);
      console.log(
        `Transaction for method create_collection executed with hash:`,
        res
      );
      const receipt = await this.provider.waitForTransaction(
        res.transaction_hash
      );
      console.log(`Transaction receipt for method create_collection:`, receipt);

      const mintEvent = receipt.events[1];
      const eventData = {
        recipientAddress: mintEvent.data[0],
        tokenId: parseInt(mintEvent.data[1], 16),
        param: parseInt(mintEvent.data[2], 16),
        contractAddress: mintEvent.from_address,
        blockNumber: receipt.block_number,
        transactionHash: receipt.transaction_hash,
        status: receipt.execution_status,
      };

      return {
        transactionHash: res.transaction_hash,
        receipt,
        eventData,
        mintEvent,
      };
    } catch (error) {
      console.error(
        `Error executing transaction for method create_collection:`,
        error
      );
      throw error;
    }
  }

  async getCollectionDetails(contractAddress) {
    const calldata = [
      {
        pauser: ContractAddress,
        name: ByteArray,
        symbol: ByteArray,
        collection_details: ByteArray,
      },
    ];
    try {
      const contract = this.getContract(contractAddress, factoryAbi);
      console.log(`Contract instance created for address ${contractAddress}`);

      const res = await contract.get_artist_collections(calldata);
      console.log(
        `Transaction for method get_collection executed with hash:`,
        res
      );

      const eventData = {
        collection: res,
      };
      console.log("eventData", eventData);

      return {
        eventData,
      };
    } catch (error) {
      console.error(
        `Error executing transaction for method get_collection:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute a transaction on a StarkNet smart contract
   * @param {string} method - The method name
   * @param {Array} calldata - Array of parameters
   * @param {Account} account - The account to sign and send the transaction
   * @returns {Promise<Object>} - Transaction result
   */
  async executeMint(email, calldata = []) {
    const account = await this.getUserWalletInfo(email);

    const account0 = new Account(
      this.provider,
      account.address,
      account.privateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const { abi } = await this.provider.getClassAt(this.Factory);
    try {
      const contract = this.getContract(this.Factory, abi);
      contract.connect(account0);
      console.log(`Contract instance created for address ${this.Factory}`);

      const myCall = contract.populate("mint_pass", calldata);
      const res = await contract.mint_pass(myCall.calldata);
      console.log(`Transaction for method mint_pass executed with hash:`, res);
      const receipt = await this.provider.waitForTransaction(
        res.transaction_hash
      );
      console.log(`Transaction receipt for method mint_pass:`, receipt);

      const mintEvent = receipt.events[1];
      const eventData = {
        recipientAddress: mintEvent.data[0],
        tokenId: parseInt(mintEvent.data[1], 16),
        param: parseInt(mintEvent.data[2], 16),
        contractAddress: mintEvent.from_address,
        blockNumber: receipt.block_number,
        transactionHash: receipt.transaction_hash,
        status: receipt.execution_status,
      };

      return {
        transactionHash: res.transaction_hash,
        receipt,
        eventData,
        mintEvent,
      };
    } catch (error) {
      console.error(`Error executing transaction for method mint_pass:`, error);
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
      if (typeof ec.getKeyPair === "function") {
        const privateKey = stark.randomAddress();
        const keyPair = ec.getKeyPair(privateKey);
        const publicKey = ec.getStarkKey(keyPair);
        return { privateKey, publicKey };
      }
      throw new Error("No compatible method found to generate key pair");
    } catch (error) {
      console.error("Error generating key pair:", error);
      throw error;
    }
  }

  /**
   * Convert a string to felt
   * @param {string} str - The string to convert
   * @returns {string} - The felt representation
   */
  stringToFelt(str) {
    const size = Math.ceil(str.length / 31);
    const arr = Array(size);

    let offset = 0;
    for (let i = 0; i < size; i++) {
      const substr = str.substring(offset, offset + 31).split("");
      const ss = substr.reduce(
        (memo, c) => memo + c.charCodeAt(0).toString(16),
        ""
      );
      arr[i] = BigInt("0x" + ss);
      offset += 31;
    }
    return arr;
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
   * Create a Starknet wallet for a user
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} - The wallet information
   */
  async createUserWallet(email) {
    try {
      let wallet = await Wallet.findOne({ email });

      if (wallet?.starknet?.encryptedPrivateKey) {
        const decryptedPrivateKey = this.decryptPrivateKey(
          wallet.starknet.encryptedPrivateKey,
          wallet.starknet.iv,
          wallet.starknet.salt
        );
        return {
          address: wallet.starknet.address,
          privateKey: decryptedPrivateKey,
          isDeployed: wallet.starknet.isDeployed || false,
        };
      }

      const OZaccountClassHash =
        "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f";
      const privateKey = stark.randomAddress();
      console.log("New OZ account:\nprivateKey=", privateKey);
      const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
      console.log("publicKey=", starkKeyPub);

      const constructorCallData = CallData.compile({ publicKey: starkKeyPub });
      const contractAddress = hash.calculateContractAddressFromHash(
        starkKeyPub,
        OZaccountClassHash,
        constructorCallData,
        0
      );
      console.log("Precalculated account address=", contractAddress);

      const {
        encrypted: encryptedPrivateKey,
        iv,
        salt,
      } = this.encryptPrivateKey(privateKey);

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
        classHash: OZaccountClassHash,
      };

      await wallet.save();

      console.log("Starknet wallet saved successfully:", {
        email,
        address: contractAddress,
        hasEncryptedKey: !!encryptedPrivateKey,
        hasIv: !!iv,
        hasSalt: !!salt,
      });

      return {
        address: contractAddress,
        privateKey,
        isDeployed: false,
      };
    } catch (error) {
      console.error("Error creating Starknet wallet for user:", error);
      throw error;
    }
  }

  /**
   * Deploy a Starknet wallet and fund it
   * @param {string} email - The user's email
   * @param {string} funderAddress - Address to fund the wallet
   * @param {string} funderPrivateKey - Private key of the funder
   * @param {number} amount - Amount to fund in wei
   * @returns {Promise<Object>} - The deployment and funding result
   */
  async deployUserWallet(
    email,
    funderAddress,
    funderPrivateKey,
    amount = 10000000000000000000
  ) {
    try {
      const wallet = await Wallet.findOne({ email });
      if (!wallet?.starknet) {
        throw new Error("No Starknet wallet found for user");
      }

      if (wallet.starknet.isDeployed) {
        return {
          address: wallet.starknet.address,
          message: "Wallet already deployed",
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

      // Verify provider connection
      const chainId = await this.provider.getChainId();
      console.log(`Connected to StarkNet network with chain ID: ${chainId}`);

      // Fund the wallet before deployment
      const fundingResult = await this.fundUserWallet(
        wallet.starknet.address,
        funderAddress,
        funderPrivateKey,
        amount
      );
      console.log("Wallet funding result:", fundingResult);

      // Create account instance for deployment
      const accountToBeDeployed = new Account(
        this.provider,
        wallet.starknet.address,
        privateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
      );

      // Prepare deployment payload
      const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
      const constructorCalldata = CallData.compile({ publicKey: starkKeyPub });
      const deployAccountPayload = {
        classHash: wallet.starknet.classHash,
        constructorCalldata: constructorCalldata,
        addressSalt: starkKeyPub,
        contractAddress: wallet.starknet.address,
      };
      console.log("Deployment payload:", deployAccountPayload);

      // Deploy the account
      const { transaction_hash, contract_address } =
        await accountToBeDeployed.deployAccount(deployAccountPayload);
      console.log("Account deployment transaction hash:", transaction_hash);

      // Wait for transaction confirmation
      const txReceipt = await this.provider.waitForTransaction(
        transaction_hash,
        {
          retryInterval: 2000,
          maxRetries: 15,
        }
      );
      console.log("Deployment transaction receipt:", txReceipt);

      // Update wallet deployment status
      wallet.starknet.isDeployed = true;
      await wallet.save();

      return {
        address: contract_address || wallet.starknet.address,
        transactionHash: transaction_hash,
        fundingTransactionHash: fundingResult.transactionHash,
        status: txReceipt?.status || "ACCEPTED_ON_L2",
        message: "Wallet deployed and funded successfully",
      };
    } catch (error) {
      console.error("Error deploying and funding Starknet wallet:", error);
      throw new Error(`Failed to deploy and fund wallet: ${error.message}`);
    }
  }

  /**
   * Fund a Starknet wallet with ETH
   * @param {string} recipientAddress - The wallet address to fund
   * @param {string} funderAddress - The funder's address
   * @param {string} funderPrivateKey - The funder's private key
   * @param {number} amount - Amount to transfer in wei
   * @returns {Promise<Object>} - The funding transaction result
   */
  async fundUserWallet(
    recipientAddress,
     funderAddress = "0x0620fd15e0b464c174933b5235c72a50376379ee1528719848e144385d0a1ed4",
    funderPrivateKey = "0x05d67e95f8d5913249452a410db389110c390a36eb0e2ecb092c670ba945b8b9",
    amount = 10000000000000000000
  ) {
    try {
        const funderAccount = new Account(
            this.provider,
            funderAddress,
            funderPrivateKey,
            undefined,
            constants.TRANSACTION_VERSION.V3
          );
      const ethContractAddress =
        "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";
      const ethContract = this.getContract(ethContractAddress, erc20);
      ethContract.connect(funderAccount)

      // Prepare transfer call
      const transferCall = ethContract.populate("transfer", [
        recipientAddress,
        amount
      ]);

      // Execute transfer
      const res = await ethContract.transfer(transferCall.calldata);

      console.log("Funding transaction hash:", res);

      // Wait for transaction confirmation
      const receipt = await this.provider.waitForTransaction(res.transaction_hash);
      console.log("Funding transaction receipt:", receipt);

      return {
        transactionHash: res.transaction_hash,
        status: receipt?.status || "ACCEPTED_ON_L2",
        amount: amount,
      };
    } catch (error) {
      console.error("Error funding wallet:", error);
      throw new Error(`Failed to fund wallet: ${error.message}`);
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
      process.env.SERVER_SECRET || "your-secret-key",
      salt,
      100000,
      32,
      "sha256"
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    return {
      encrypted,
      iv: iv.toString("hex"),
      salt: salt.toString("hex"),
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
    if (!encrypted || !iv || !salt) {
      throw new Error("Missing required parameters for decryption");
    }

    const saltBuffer = Buffer.from(salt, "hex");
    const ivBuffer = Buffer.from(iv, "hex");
    const key = crypto.pbkdf2Sync(
      process.env.SERVER_SECRET || "your-secret-key",
      saltBuffer,
      100000,
      32,
      "sha256"
    );
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Get transaction details
   * @param {string} txHash - The transaction hash
   * @returns {Promise<Object>} - Complete transaction details
   */
  async getTransactionDetails(txHash) {
    try {
      const transaction = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      let blockInfo = null;
      if (transaction.block_number) {
        blockInfo = await this.provider.getBlock(transaction.block_number);
      }

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
   * Retrieve user's wallet information
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} - The wallet information
   */
  async getUserWalletInfo(email) {
    try {
      const wallet = await Wallet.findOne({ email });
      console.log("Wallet found:", !!wallet);
      console.log("Wallet starknet data:", wallet?.starknet);

      if (!wallet) {
        throw new Error("No wallet found for user");
      }

      if (!wallet?.starknet) {
        throw new Error("No Starknet wallet found for user");
      }

      const starknetWallet = wallet.starknet;
      console.log("Starknet wallet data:", {
        hasAddress: !!starknetWallet.address,
        hasEncryptedPrivateKey: !!starknetWallet.encryptedPrivateKey,
        hasIv: !!starknetWallet.iv,
        hasSalt: !!starknetWallet.salt,
        isDeployed: starknetWallet.isDeployed,
      });

      if (
        !starknetWallet.encryptedPrivateKey ||
        !starknetWallet.iv ||
        !starknetWallet.salt
      ) {
        throw new Error(
          "Wallet encryption data is missing. Please recreate the wallet."
        );
      }

      const decryptedPrivateKey = this.decryptPrivateKey(
        starknetWallet.encryptedPrivateKey,
        starknetWallet.iv,
        starknetWallet.salt
      );

      return {
        address: starknetWallet.address,
        privateKey: decryptedPrivateKey,
        isDeployed: starknetWallet.isDeployed || false,
      };
    } catch (error) {
      console.error("Error retrieving wallet information:", error);
      throw error;
    }
  }

  async getStarkNetUSDCBalance(starknetAddress, usdcAddress = null) {
    try {
      const USDC_ADDRESS =
        usdcAddress ||
        "0x0475e85c9f471885c1624c297862df9aaffa82ad55c7d1fde1ac892232445e06";
      const contract = new Contract(usdcAbi, USDC_ADDRESS, this.provider);
      const response = await contract.balance_of(starknetAddress);
      console.log("response", response);

      const balance = response;
      if (!this.parseUint256(balance)) {
        return {
          address: starknetAddress,
          balance: "0",
          balanceFloat: 0,
          usdcPrice: 1,
          usdValue: 0,
        };
      }
      const parsedBalance = this.parseUint256(balance);
      console.log("parsedBalance", parsedBalance);
      const balanceFloat = Number(this.parseUint256(balance)) / 1e6;
      console.log("balanceFloat", balanceFloat);

      // Get USDC price from Pyth
      const priceUpdate = await this.hermesClient.getLatestPriceUpdates([
        this.usdcPriceId,
      ]);
      const pythPrice = priceUpdate.parsed[0]?.price;
      const usdcPrice = pythPrice
        ? Number(pythPrice.price) / Math.pow(10, Math.abs(pythPrice.expo))
        : 1;

      return {
        address: starknetAddress,
        balance: balance.toString(),
        balanceFloat,
        usdcPrice,
        usdValue: balanceFloat * usdcPrice,
        response,
      };
    } catch (error) {
      console.error("Error fetching StarkNet USDC balance:", error);
      throw new Error("Failed to fetch StarkNet USDC balance");
    }
  }
}

export const starknetService = new StarknetService();
