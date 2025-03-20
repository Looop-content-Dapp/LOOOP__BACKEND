const {
  GasPrice,
  SigningStargateClient,
  calculateFee,
  coins,
} = require("@cosmjs/stargate");
const { fetchConfig } = require("@burnt-labs/constants");
const { makeCosmoshubPath } = require("@cosmjs/amino");
const { GranteeSignerClient } = require("./GranteeSignerClient.cjs");
const { SignArbSecp256k1HdWallet } = require("./SignArbSecp256k1HdWallet.cjs");
const crypto = require("crypto");
const { Wallet } = require("../models/wallet.model.js");
const { Bip39 } = require("@cosmjs/crypto");
const { Registry } = require("@cosmjs/proto-signing/build");
const { CosmWasmClient } = require("@cosmjs/cosmwasm-stargate/build");
const { MsgGrantAllowance } = require("cosmjs-types/cosmos/feegrant/v1beta1/tx");
const { BasicAllowance } = require("cosmjs-types/cosmos/feegrant/v1beta1/feegrant");
const { Any } = require("cosmjs-types/google/protobuf/any");
const { HermesClient } = require("@pythnetwork/hermes-client");
const { RpcProvider, Contract } = require("starknet");

const USDC_ABI = [
    {
      name: "balanceOf",
      type: "function",
      inputs: [{ name: "account", type: "felt" }],
      outputs: [{ name: "balance", type: "Uint256" }],
      stateMutability: "view"
    }
  ];

class AbstraxionAuth {

  // static instance = null;


  constructor() {
    // if (AbstraxionAuth.instance) {
    //   return AbstraxionAuth.instance;
    // }

    this.rpcUrl = undefined;
    this.restUrl = undefined;
    this.treasury = undefined;
    this.serverSecret =
      process.env.SERVER_SECRET ||
      (() => {
        throw new Error("SERVER_SECRET is required in .env");
      })();
    this.client = undefined;
    this.abstractAccount = undefined;
    this.isLoggedIn = false;
    this.sessionToken = undefined;
    this.sessionTimeout = undefined;
    this.authStateChangeSubscribers = [];
    this.hermesClient = new HermesClient("https://hermes.pyth.network", {

    });
    this.starknetProvider = new RpcProvider({
        nodeUrl: process.env.STARKNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io"
      });
      this.usdcContractAddress = process.env.STARKNET_USDC_ADDRESS || "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
    this.usdcPriceId = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

    console.log("Initialized with Server Secret:", this.serverSecret);
  }

  configureAbstraxionInstance(rpc, restUrl, treasury) {
    this.rpcUrl = rpc;
    this.restUrl = restUrl;
    this.treasury = treasury;
  }

  subscribeToAuthStateChange(callback) {
    this.authStateChangeSubscribers.push(callback);
    return () => {
      const index = this.authStateChangeSubscribers.indexOf(callback);
      if (index !== -1) this.authStateChangeSubscribers.splice(index, 1);
    };
  }

  triggerAuthStateChange(isLoggedIn) {
    this.isLoggedIn = isLoggedIn;
    this.authStateChangeSubscribers.forEach((callback) => callback(isLoggedIn));
  }

  getGranter() {
    const granter = process.env.GRANTER_ADDRESS;
    if (granter && !granter.startsWith("xion1")) {
      console.warn(
        'GRANTER_ADDRESS is invalid; must start with "xion1". Proceeding without granter:',
        granter
      );
      return undefined;
    }
    return granter;
  }

  setGranter(address) {
    // Optionally store in session/db if needed
  }

  encryptMnemonic(mnemonic) {
    console.log("Encrypting with Server Secret:", this.serverSecret);
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(
      this.serverSecret,
      salt,
      100000,
      32,
      "sha256"
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(mnemonic, "utf8", "hex");
    encrypted += cipher.final("hex");
    console.log("Encrypted Data:", {
      encrypted,
      iv: iv.toString("hex"),
      salt: salt.toString("hex"),
    });
    return { encrypted, iv: iv.toString("hex"), salt: salt.toString("hex") };
  }

  decryptMnemonic(encrypted, iv, salt) {
    console.log("Decrypting with:", {
      encrypted,
      iv,
      salt,
      serverSecret: this.serverSecret,
    });
    const saltBuffer = Buffer.from(salt, "hex");
    const ivBuffer = Buffer.from(iv, "hex");
    const key = crypto.pbkdf2Sync(
      this.serverSecret,
      saltBuffer,
      100000,
      32,
      "sha256"
    );
    console.log("Derived Key:", key.toString("hex"));
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    console.log("Decrypted:", decrypted);
    return decrypted;
  }

  generateDeterministicMnemonic(email) {
    const seed = crypto.pbkdf2Sync(
      email,
      this.serverSecret,
      100000,
      32,
      "sha256"
    );
    return Bip39.encode(seed).toString();
  }

  async signup(email) {
    let wallet = await Wallet.findOne({ email });
    let mnemonic, encryptedData, address;
    let warnings = [];

    if (wallet) {
      console.log("Wallet found, reusing stored mnemonic for:", email);
      mnemonic = this.decryptMnemonic(
        wallet.xion.encryptedMnemonic,
        wallet.xion.iv,
        wallet.xion.salt
      );
      encryptedData = {
        encrypted: wallet.xion.encryptedMnemonic,
        iv: wallet.xion.iv,
        salt: wallet.xion.salt,
      };
      address = wallet.xion.address;
    } else {
      mnemonic = this.generateDeterministicMnemonic(email);
      const keypair = await SignArbSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: "xion",
        hdPaths: [makeCosmoshubPath(0)],
      });
      encryptedData = this.encryptMnemonic(mnemonic);
      const accounts = await keypair.getAccounts();
      address = accounts[0].address;

      try {
        await this.grantFeeAllowance(address);
      } catch (error) {
        console.error(`Fee grant failed for ${address}:`, error);
        warnings.push(
          "Fee grant failed. You may need to fund your account manually to execute transactions."
        );
      }

      wallet = await Wallet.create({
        email,
        xion: {
          address,
          encryptedMnemonic: encryptedData.encrypted,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
        },
      });
    }

    const keypair = await SignArbSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: "xion",
      hdPaths: [makeCosmoshubPath(0)],
    });
    this.abstractAccount = keypair;
    this.sessionToken = crypto.randomBytes(16).toString("hex");
    this.sessionTimeout = setTimeout(() => this.logout(), 30 * 60 * 1000); // 30 minutes
    this.triggerAuthStateChange(true);

    console.log("Signup Data:", { email, address, mnemonic, warnings });
    return {
      address,
      mnemonic,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    };
  }

  async login(email) {
    const wallet = await Wallet.findOne({ email });
    if (!wallet) throw new Error("Wallet not found");

    try {
      const mnemonic = this.decryptMnemonic(
        wallet.xion.encryptedMnemonic,
        wallet.xion.iv,
        wallet.xion.salt
      );
      const keypair = await SignArbSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: "xion",
        hdPaths: [makeCosmoshubPath(0)],
      });

      const granter = this.getGranter();

      if (granter) {
        const accounts = await keypair.getAccounts();
        const keypairAddress = accounts[0].address;
        const pollSuccess = await this.pollForGrants(keypairAddress, granter);
        console.log("Grant Check Result:", pollSuccess);
        if (!pollSuccess) {
          console.warn(
            "No valid grants found; proceeding without grant verification:",
            { grantee: keypairAddress, granter }
          );
        }
        this.setGranter(granter);
      } else {
        console.log("No granter address provided; skipping grant check.");
      }

      this.abstractAccount = keypair;
      this.sessionToken = crypto.randomBytes(16).toString("hex");
      this.sessionTimeout = setTimeout(() => this.logout(), 30 * 60 * 1000); // 30 minutes
      this.triggerAuthStateChange(true);
      return keypair;
    } catch (error) {
      console.error("Login Error:", error);
      throw new Error(
        "Failed to login - check data integrity or grant configuration"
      );
    }
  }

  async getBalances(
    address,
    denoms = [
      "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",
    ],
    starknetAddress = null
  ) {
    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    const client = await CosmWasmClient.connect(this.rpcUrl);
    const balances = await Promise.all(
      denoms.map((denom) => client.getBalance(address, denom))
    );

    // Get USDC price from Pyth
    try {
      const priceUpdate = await this.hermesClient.getLatestPriceUpdates([this.usdcPriceId]);
      const pythPrice = priceUpdate.parsed[0]?.price;
      const usdcPrice = pythPrice ? Number(pythPrice.price) / Math.pow(10, Math.abs(pythPrice.expo)) : 1;

      // Get Cosmos balances
      const cosmosBalances = balances.map((balance) => ({
        denom: balance.denom,
        amount: balance.amount,
        amountFloat: Number(balance.amount) / 1e6,
        usdValue: (Number(balance.amount) / 1e6) * usdcPrice || 0
      }));
      console.log("Cosmos Balances:", cosmosBalances);

      // Get StarkNet balance if address is provided
      let starknetBalance = 0;
      if (starknetAddress) {
        starknetBalance = await this.getStarkNetUSDCBalance(starknetAddress);
        console.log("StarkNet Balance:", starknetBalance);
      }

      return {
        cosmos: cosmosBalances,
        starknet: starknetBalance,
        usdcPrice
      };

    } catch (error) {
      console.error("Failed to fetch prices or balances:", error);
      return {
        cosmos: balances.map((balance) => ({
          denom: balance.denom,
          amount: balance.amount,
          amountFloat: Number(balance.amount) / 1e6,
          usdValue: 0
        })),
        starknet: null,
        usdcPrice: 1
      };
    }
  }

  async getTransactionHistory(address, limit = 10) {
    if (!this.rpcUrl || !this.restUrl)
      throw new Error("RPC and REST URLs must be configured");

    const url = `${this.restUrl}/cosmos/tx/v1beta1/txs?events=transfer.recipient='${address}'&order_by=2&pagination.limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch transaction history");

    const data = await res.json();
    return data.tx_responses || [];
  }

  async getFeeGrants(grantee) {
    if (!this.rpcUrl) throw new Error("AbstraxionAuth needs to be configured.");
    const restUrl = this.restUrl || (await fetchConfig(this.rpcUrl)).restUrl;
    const url = `${restUrl}/cosmos/feegrant/v1beta1/allowances/${grantee}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.allowances || [];
  }

  async revokeFeeGrant(granteeAddress, granterAddress) {
    const signer = await this.getSigner();
    const accounts = await this.abstractAccount.getAccounts();
    const senderAddress = accounts[0].address;

    const registry = new Registry();
    // Note: MsgRevokeAllowance needs to be implemented or imported correctly in JS
    // registry.register("/cosmos.feegrant.v1beta1.MsgRevokeAllowance", MsgRevokeAllowance);

    const msg = {
      typeUrl: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance",
      value: { granter: granterAddress, grantee: granteeAddress },
    };

    const fee = { amount: coins(5000, "uxion"), gas: "200000" };
    await signer.signAndBroadcast(
      senderAddress,
      [msg],
      fee,
      "Revoking fee grant"
    );
  }

  async exportWallet(email) {
    const wallet = await Wallet.findOne({ email });
    if (!wallet) throw new Error("Wallet not found");

    return {
      address: wallet.xion.address,
      encryptedMnemonic: wallet.xion.encryptedMnemonic,
      iv: wallet.xion.iv,
      salt: wallet.xion.salt,
    };
  }

  async resetEmail(currentEmail, newEmail) {
    const wallet = await Wallet.findOne({ email: currentEmail });
    if (!wallet) throw new Error("Wallet not found");

    const existingWallet = await Wallet.findOne({ email: newEmail });
    if (existingWallet)
      throw new Error("New email is already registered to another wallet");

    wallet.email = newEmail;
    await wallet.save();

    console.log("Email Reset Successful:", {
      oldEmail: currentEmail,
      newEmail,
    });
    return {
      message: "Email updated successfully",
      newEmail,
      address: wallet.xion.address,
    };
  }

  async getKeypairAddress() {
    if (!this.abstractAccount) return "";
    const accounts = await this.abstractAccount.getAccounts();
    return accounts[0]?.address || "";
  }

  async getSigner() {
    let useGranter = false;
    const granterAddress = this.getGranter();
    const granteeAddress = await this.getKeypairAddress();

    if (granterAddress) {
      const grants = await this.getFeeGrants(granteeAddress);
      useGranter = grants.some(
        (grant) =>
          grant.granter === granterAddress &&
          (!grant.expiration || new Date(grant.expiration) > new Date())
      );
      console.log("Fee Grant Check:", {
        granteeAddress,
        granterAddress,
        hasGrant: useGranter,
      });
    }

    const signer = await GranteeSignerClient.connectWithSigner(
      this.rpcUrl,
      this.abstractAccount,
      {
        gasPrice: GasPrice.fromString("0uxion"),
        granterAddress: useGranter ? granterAddress : undefined,
        granteeAddress,
        treasuryAddress: this.treasury,
      }
    );
    return { signer, useGranter };
  }

  async getNFTsForAddress(walletAddress, contractAddress) {
    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    try {
      const client = await CosmWasmClient.connect(this.rpcUrl);
      const queryMsg = { tokens: { owner: walletAddress, limit: 10 } };
      const response = await client.queryContractSmart(
        contractAddress,
        queryMsg
      );

      if (!response || !Array.isArray(response.tokens)) {
        console.warn(
          `No NFTs found or invalid response for ${walletAddress} at ${contractAddress}`
        );
        return [];
      }

      console.log(`NFTs retrieved for ${walletAddress}:`, response.tokens);
      return response.tokens;
    } catch (error) {
      console.error(
        `Error fetching NFTs for ${walletAddress} from ${contractAddress}:`,
        error
      );
      throw new Error(
        "Failed to fetch NFTs - ensure the contract address is valid and the network is accessible"
      );
    }
  }

  async getLoggedInUserNFTs(contractAddress) {
    if (!this.isLoggedIn || !this.abstractAccount) {
      throw new Error("User must be logged in to fetch their NFTs");
    }

    const walletAddress = await this.getKeypairAddress();
    return this.getNFTsForAddress(walletAddress, contractAddress);
  }

  async executeSmartContract(contractAddress, msg, memo) {
    if (!this.isLoggedIn || !this.abstractAccount)
      throw new Error("User must be logged in to execute a smart contract");
    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    const { signer, useGranter } = await this.getSigner();
   const accounts = await this.abstractAccount.getAccounts();
   const senderAddress = accounts[0].address;

    try {
        if (!useGranter) {
            const client = await CosmWasmClient.connect(this.rpcUrl);
            const balance = await client.getBalance(senderAddress, "uxion");
            if (BigInt(balance.amount) < 5000n) {
              throw new Error("Insufficient uxion balance to cover fees");
            }
        }

      const fee = { amount: coins(5000, "uxion"), gas: "2000000" };
      const result = await signer.execute(
        senderAddress,
        contractAddress,
        msg,
        fee,
        memo || "Smart contract execution via Looop Music Wallet"
      );

      console.log("Smart Contract Execution Result:", {
        transactionHash: result.transactionHash,
        sender: senderAddress,
        contractAddress,
        msg,
      });

      return {
        transactionHash: result.transactionHash,
        sender: senderAddress,
        contractAddress,
        msg,
        result
      };
    } catch (error) {
      console.error("Error executing smart contract:", error);
      if (error.message.includes("fee-grant not found")) {
        throw new Error(
          "Fee grant not found for this address; ensure sufficient uxion balance or valid fee grant"
        );
      }
      if (
        error.message.includes("account") &&
        error.message.includes("not found")
      ) {
        throw new Error(
          "Sender account not found on Xion - fund the account with uxion tokens first"
        );
      }
      if (error.message.includes("decoding bech32 failed")) {
        console.warn(
          "Invalid granter address detected; execution attempted without granter"
        );
      }
      throw error;
    }
  }

  async querySmartContract(contractAddress, queryMsg) {
    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    try {
      const client = await CosmWasmClient.connect(this.rpcUrl);
      const response = await client.queryContractSmart(contractAddress, queryMsg);

      console.log("Smart Contract Query Result:", {
        contractAddress,
        queryMsg,
        response,
      });

      return response;
    } catch (error) {
      console.error("Error querying smart contract:", error);
      if (error.message.includes("not found")) {
        throw new Error(
          "Contract not found - ensure the contract address is valid"
        );
      }
      throw error;
    }
  }

  logout() {
    this.abstractAccount = undefined;
    this.sessionToken = undefined;
    if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
    this.triggerAuthStateChange(false);
  }

  getSessionToken() {
    return this.sessionToken;
  }

  async pollForGrants(grantee, granter) {
    if (!this.rpcUrl) throw new Error("AbstraxionAuth needs to be configured.");
    const restUrl = this.restUrl || (await fetchConfig(this.rpcUrl)).restUrl;
    const url = `${restUrl}/cosmos/authz/v1beta1/grants?grantee=${grantee}&granter=${granter}`;
    console.log("Polling Grants API:", url);

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error("Grant API request failed:", {
          status: res.status,
          statusText: res.statusText,
        });
        return false;
      }
      const data = await res.json();

      if (!data || !Array.isArray(data.grants)) {
        console.warn("Invalid grant response format:", data);
        return false;
      }
      if (data.grants.length === 0) return false;

      const currentTime = new Date().toISOString();
      return data.grants.some(
        (grant) => !grant.expiration || grant.expiration > currentTime
      );
    } catch (error) {
      console.error("Error polling grants:", error);
      return false;
    }
  }

  async grantFeeAllowance(granteeAddress) {
    const granterMnemonic = process.env.GRANTER_MNEMONIC;
    if (!granterMnemonic) {
      console.error("GRANTER_MNEMONIC not set in .env; skipping fee grant");
      return;
    }

    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    try {
      const granterWallet = await SignArbSecp256k1HdWallet.fromMnemonic(
        granterMnemonic,
        { prefix: "xion" }
      );
      const registry = new Registry();
      registry.register("/cosmos.feegrant.v1beta1.MsgGrantAllowance", MsgGrantAllowance);
      registry.register("/cosmos.feegrant.v1beta1.BasicAllowance", BasicAllowance);

      const client = await SigningStargateClient.connectWithSigner(
        this.rpcUrl,
        granterWallet,
        { registry }
      );
      const [granterAccount] = await granterWallet.getAccounts();
      const granterAddress = granterAccount.address;

      const allowanceValue = BasicAllowance.fromPartial({
        spendLimit: coins(1000000, "uxion"),
      });

      const packedAllowance = Any.fromPartial({
        typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance",
        value: BasicAllowance.encode(allowanceValue).finish(),
      });

      const msg = {
        typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
        value: MsgGrantAllowance.fromPartial({
          granter: granterAddress,
          grantee: granteeAddress,
          allowance: packedAllowance,
        }),
      };

      const fee = { amount: coins(5000, "uxion"), gas: "200000" };
      const result = await client.signAndBroadcast(
        granterAddress,
        [msg],
        fee,
        "Granting fee allowance to new user"
      );
      console.log(
        `Fee grant issued to ${granteeAddress}. Tx Hash: ${result.transactionHash}`
      );
    } catch (error) {
      console.error(
        `Failed to grant fee allowance to ${granteeAddress}:`,
        error
      );
      throw error; // Re-throw to allow the caller (e.g., signup) to handle it
    }
  }

  async getStarkNetUSDCBalance(starknetAddress) {
    try {
      const contract = new Contract(USDC_ABI, this.usdcContractAddress, this.starknetProvider);
      const response = await contract.balanceOf(starknetAddress);

      // StarkNet response structure is different, need to handle it properly
      const balance = response.balance;
      console.log("balance:", balance);
      // Check if balance is undefined or null (e.g., if the account doesn)
      if (!balance || !balance.low) {
        return {
          address: starknetAddress,
          balance: "0",
          balanceFloat: 0,
          usdcPrice: 1,
          usdValue: 0
        };
      }

      // Convert balance to number (assuming 6 decimals for USDC)
      const balanceFloat = Number(balance.low.toString()) / 1e6;

      // Get USDC price from Pyth
      const priceUpdate = await this.hermesClient.getLatestPriceUpdates([this.usdcPriceId]);
      const pythPrice = priceUpdate.parsed[0]?.price;
      const usdcPrice = pythPrice ? Number(pythPrice.price) / Math.pow(10, Math.abs(pythPrice.expo)) : 1;

      return {
        address: starknetAddress,
        balance: balance.low.toString(),
        balanceFloat,
        usdcPrice,
        usdValue: balanceFloat * usdcPrice,
      };
    } catch (error) {
      console.error("Error fetching StarkNet USDC balance:", error);
      throw new Error("Failed to fetch StarkNet USDC balance");
    }
  }

  async mintPass(collectionAddress) {
    if (!this.isLoggedIn || !this.abstractAccount) {
      throw new Error("User must be logged in to mint a pass");
    }
    if (!this.rpcUrl) throw new Error("RPC URL must be configured");

    try {
      const { signer, useGranter } = await this.getSigner();
      const accounts = await this.abstractAccount.getAccounts();
      const senderAddress = accounts[0].address;

            // Check USDC balance before minting
            const client = await CosmWasmClient.connect(this.rpcUrl);
            const balance = await client.getBalance(
              senderAddress,
              "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"
            );
            console.log("USDC Balance:", balance)

            if (BigInt(balance.amount) < 5000000n) {
              throw new Error("Insufficient USDC balance to mint pass");
            }


      const mintMsg = {
       extension: {
            msg: {
                mint_pass: {}
            }
        }
      };

      // Using the correct USDC denomination for Xion testnet 2
      const funds = coins(5000000, "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4");

      const fee = { amount: coins(5000, "uxion"), gas: "2000000" };
      const result = await signer.execute(
        senderAddress,
        collectionAddress,
        mintMsg,
        fee,
        "Minting pass via Looop Music Wallet",
        funds
      );

      console.log("Pass Mint Result:", {
        transactionHash: result.transactionHash,
        sender: senderAddress,
        contractAddress: collectionAddress,
        payment: funds
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        sender: senderAddress,
        contractAddress: collectionAddress
      };

    } catch (error) {
      console.error("Error minting pass:", error);
      throw new Error(`Failed to mint pass: ${error.message}`);
    }
  }
}

module.exports = new AbstraxionAuth();
