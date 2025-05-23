import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";

export class ContractHelper {
  static instance = null;
  static MAX_RETRY_ATTEMPTS = 3;
  static RETRY_DELAY = 5000; // 5 seconds

  constructor(config) {
    if (ContractHelper.instance) {
      return ContractHelper.instance;
    }

    this.config = config;
    this.client = null;
    this.adminWallet = null;
    this.walletadmin = null;
    this.initializationAttempts = 0;

    ContractHelper.instance = this;

    this.initializeAdminWallet();
  }

  async initializeAdminWallet() {
    try {
      this.adminWallet = await DirectSecp256k1HdWallet.fromMnemonic(
        "mesh mother student depart pudding credit year couch gown festival volcano update pumpkin picnic girl pull cram future noise salmon unable ceiling flock remain",
        { prefix: "xion" }
      );

      // Add retry logic for RPC connection
      let lastError = null;
      while (this.initializationAttempts < ContractHelper.MAX_RETRY_ATTEMPTS) {
        try {
          this.client = await SigningCosmWasmClient.connectWithSigner(
            this.config.rpcEndpoint,
            this.adminWallet,
            {
              gasPrice: GasPrice.fromString("0.001uxion"),
            }
          );

          const [account] = await this.adminWallet.getAccounts();
          this.walletadmin = account.address;
          console.log("Admin wallet initialized with address:", account.address);
          return; // Success, exit the function

        } catch (error) {
          lastError = error;
          this.initializationAttempts++;
          console.warn(`RPC connection attempt ${this.initializationAttempts} failed:`, error.message);

          if (this.initializationAttempts < ContractHelper.MAX_RETRY_ATTEMPTS) {
            console.log(`Retrying in ${ContractHelper.RETRY_DELAY/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, ContractHelper.RETRY_DELAY));
          }
        }
      }

      // If we get here, all attempts failed
      throw new Error(`Failed to initialize admin wallet after ${ContractHelper.MAX_RETRY_ATTEMPTS} attempts. Last error: ${lastError.message}`);

    } catch (error) {
      console.error("Failed to initialize admin wallet:", error);
      // Don't throw the error, just log it and continue
      // This allows the application to start even if XION integration fails
    }
  }

  async createArtistCommunity({ artistAddress, communityDetails }) {
    if (!this.client) await this.initializeAdminWallet();

    const { name, symbol, imageUrl } = communityDetails;

    const msg = {
      create_collection: {
        name: name,
        symbol: symbol,
        artist: artistAddress,
        minter: this.walletadmin,
        collection_info: imageUrl,
      },
    };

    try {
      const result = await this.client.execute(
        this.walletadmin,
        this.config.factoryAddress,
        msg,
        "auto"
      );

      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      console.error("Failed to create community:", error);
      const errorMessage = error.message.includes("bech32")
        ? `Invalid address format. Please check artist address (${artistAddress}) and admin address (${this.walletadmin})`
        : error.message;
      throw new Error(errorMessage);
    }
  }

  async mintNFTPass({ collectionAddress, userAddress }) {
    if (!this.client) await this.initializeAdminWallet();

    console.log(collectionAddress, userAddress);

    const msg = {
      extension: {
        msg: {
          mint_pass: {
            owner_address: userAddress,
          },
        },
      },
    };

    try {
      const result = await this.client.execute(
        this.walletadmin,
        collectionAddress,
        msg,
        "auto",
        undefined,
        [{ denom: "uxion", amount: "1000" }] // Pass price
      );

      return {
        success: true,
        // tokenId,
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      console.error("Failed to mint NFT:", error);
      throw error;
    }
  }

  async queryNFTPass(collectionAddress, tokenId) {
    if (!this.client) await this.initializeAdminWallet();

    try {
      return await this.client.queryContractSmart(collectionAddress, {
        extension: {
          msg: {
            check_validity: {
              token_id: `pass-${tokenId}`,
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to query NFT:", error);
      throw error;
    }
  }

  async getCollection(artist) {
    if (this.client) {
      return this.client.queryContractSmart(this.config.factoryAddress, {
        collection: {
          artist,
        },
      });
    }
  }

  async queryCollectionBySymbol(contractAddress, symbol) {
    const queryMsg = {
      extension: {
        msg: {
          collection_by_symbol: {
            symbol: symbol,
          },
        },
      },
    };
    const response = await this.client.queryContractSmart(
      contractAddress,
      queryMsg
    );
    return response;
  }

  async queryUserPass({ symbol, owner, collectionAddress }) {
    const queryMsg = {
      extension: {
        msg: {
          get_user_pass: {
            symbol: symbol,
            owner: owner,
          },
        },
      },
    };

    const response = await this.client.queryContractSmart(
      collectionAddress,
      queryMsg
    );
    return response;
  }

  async signAgreement({ contractAddress, artistAddress, artistName }) {
    if (!this.client) await this.initializeAdminWallet();

    const msg = {
      sign_agreement: {
        artist_address: artistAddress,
        artist_name: artistName,
      },
    };

    try {
      const result = await this.client.execute(
        this.walletadmin,
        contractAddress,
        msg,
        "auto"
      );

      return {
        success: true,
        transactionHash: result.transactionHash,
      };
    } catch (error) {
      console.error("Failed to sign agreement:", error);
      throw error;
    }
  }

  async getBalance(address) {
    try {
      if (!this.client) await this.initializeAdminWallet();

      const balance = await this.client.getBalance(address, "usdc");
      return balance;
    } catch (error) {
      console.error("Error getting balance:", error);
      throw new Error("Failed to get balance");
    }
  }
}

const CONTRACT_CONFIG = {
  factoryAddress:
    "xion106z7nrejkjzps0qmpwkykg8w6nryxyht9nsu0j3t5kcmd4v0sfks9har0d",
  rpcEndpoint: "https://rpc.xion-testnet-2.burnt.com:443",
  network: {
    denom: "uxion",
    chainId: "xion-testnet-2",
  },
  fee: {
    gas: "387561",
  },
  gasPrice: "0.001",
};

const contractHelper = new ContractHelper(CONTRACT_CONFIG);
export default contractHelper;
