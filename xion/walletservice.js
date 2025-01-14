import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { toBech32 } from "@cosmjs/encoding";
import { rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino";
import crypto from "crypto";

class WalletService {
  async createXionWallet() {
    try {
      // Generate a random private key
      const privateKey = crypto.randomBytes(32);

      // Create a wallet instance
      const wallet = await DirectSecp256k1Wallet.fromKey(privateKey, "xion");

      // Get the account details
      const [account] = await wallet.getAccounts();

      // Generate the Xion address
      const address = toBech32(
        "xion",
        rawSecp256k1PubkeyToRawAddress(account.pubkey)
      );

      // do some ecrypt stuff
      return {
        address,
        privateKey: privateKey.toString("hex"),
      };
    } catch (error) {
      console.error("Error creating Xion wallet:", error);
      throw new Error("Failed to create Xion wallet");
    }
  }

  async getBalance(address) {
    try {
      const client = await SigningStargateClient.connect(this.rpcEndpoint);
      const balance = await client.getAllBalances(address);
      return balance;
    } catch (error) {
      console.error("Error getting balance:", error);
      throw new Error("Failed to get balance");
    }
  }

  encryptPrivateKey(privateKey, password) {
    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
      const cipher = crypto.createCipheriv("aes-256-gcm", key, salt);

      let encrypted = cipher.update(privateKey, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        salt: salt.toString("hex"),
        authTag: authTag.toString("hex"),
      };
    } catch (error) {
      console.error("Error encrypting private key:", error);
      throw new Error("Failed to encrypt private key");
    }
  }

  decryptPrivateKey(encryptedData, password) {
    try {
      const { encrypted, salt, authTag } = encryptedData;
      const saltBuffer = Buffer.from(salt, "hex");
      const key = crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, "sha256");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, saltBuffer);
      decipher.setAuthTag(Buffer.from(authTag, "hex"));

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Error decrypting private key:", error);
      throw new Error("Failed to decrypt private key");
    }
  }
}

export const walletService = new WalletService();
