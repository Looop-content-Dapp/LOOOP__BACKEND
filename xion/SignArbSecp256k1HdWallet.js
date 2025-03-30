import { Buffer } from "buffer";
import { makeSignBytes, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
  encodeSecp256k1Signature,
  makeCosmoshubPath,
  rawSecp256k1PubkeyToRawAddress,
} from "@cosmjs/amino";
import { assert, isNonNullObject } from "@cosmjs/utils";
import { Hash, PrivKeySecp256k1 } from "@keplr-wallet/crypto";
import {
  Argon2id,
  Bip39,
  EnglishMnemonic,
  pathToString,
  Random,
  Secp256k1,
  sha256,
  Slip10,
  Slip10Curve,
  stringToPath,
} from "@cosmjs/crypto";
import {
  fromBase64,
  fromUtf8,
  toBase64,
  toBech32,
  toUtf8,
} from "@cosmjs/encoding";
import { makeADR36AminoSignDoc, serializeSignDoc } from "@keplr-wallet/cosmos";
import {
  cosmjsSalt,
  decrypt,
  encrypt,
  executeKdf,
  supportedAlgorithms,
} from "@cosmjs/proto-signing/build/wallet.js";

const serializationTypeV1 = "directsecp256k1hdwallet-v1";

const basicPasswordHashingOptions = {
  algorithm: "argon2id",
  params: {
    outputLength: 32,
    opsLimit: 24,
    memLimitKib: 12 * 1024,
  },
};

const defaultOptions = {
  bip39Password: "",
  hdPaths: [makeCosmoshubPath(0)],
  prefix: "cosmos",
};

function isDerivationJson(thing) {
  if (!isNonNullObject(thing)) return false;
  if (typeof thing.hdPath !== "string") return false;
  if (typeof thing.prefix !== "string") return false;
  return true;
}

export class SignArbSecp256k1HdWallet extends DirectSecp256k1HdWallet {
  constructor(mnemonic, options) {
    const prefix = options.prefix || defaultOptions.prefix;
    const hdPaths = options.hdPaths || defaultOptions.hdPaths;
    this.secret = mnemonic;
    this.seed = options.seed;
    this.accounts = hdPaths.map(hdPath => ({
      hdPath,
      prefix,
    }));
  }

  static async fromMnemonic(mnemonic, options = {}) {
    const mnemonicChecked = new EnglishMnemonic(mnemonic);
    const seed = await Bip39.mnemonicToSeed(
      mnemonicChecked,
      options.bip39Password,
    );
    return new SignArbSecp256k1HdWallet(mnemonicChecked, {
      ...options,
      seed,
    });
  }

  static async generate(length = 12, options = {}) {
    const entropyLength = 4 * Math.floor((11 * length) / 33);
    const entropy = Random.getBytes(entropyLength);
    const mnemonic = Bip39.encode(entropy);
    return this.fromMnemonic(mnemonic.toString(), options);
  }

  static async deserialize(serialization, password) {
    const root = JSON.parse(serialization);
    if (!isNonNullObject(root)) {
      throw new Error("Root document is not an object.");
    }
    if (root.type === serializationTypeV1) {
      return this.deserializeTypeV1(serialization, password);
    }
    throw new Error("Unsupported serialization type");
  }

  static async deserializeWithEncryptionKey(serialization, encryptionKey) {
    const root = JSON.parse(serialization);
    if (!isNonNullObject(root)) {
      throw new Error("Root document is not an object.");
    }
    switch (root.type) {
      case serializationTypeV1: {
        const decryptedBytes = await decrypt(
          fromBase64(root.data),
          encryptionKey,
          root.encryption,
        );
        const decryptedDocument = JSON.parse(fromUtf8(decryptedBytes));
        const { mnemonic, accounts } = decryptedDocument;
        assert(typeof mnemonic.data === "string");
        if (!Array.isArray(accounts)) {
          throw new Error("Property 'accounts' is not an array");
        }
        if (!accounts.every(account => isDerivationJson(account))) {
          throw new Error("Account is not in the correct format.");
        }
        const firstPrefix = accounts[0].prefix;
        if (!accounts.every(({ prefix }) => prefix === firstPrefix)) {
          throw new Error("Accounts do not all have the same prefix");
        }
        const hdPaths = accounts.map(({ hdPath }) => stringToPath(hdPath));
        return this.fromMnemonic(mnemonic.data, {
          hdPaths,
          prefix: firstPrefix,
        });
      }
      default:
        throw new Error("Unsupported serialization type");
    }
  }

  static async deserializeTypeV1(serialization, password) {
    const root = JSON.parse(serialization);
    if (!isNonNullObject(root)) {
      throw new Error("Root document is not an object.");
    }
    const encryptionKey = await executeKdf(password, root.kdf);
    return this.deserializeWithEncryptionKey(serialization, encryptionKey);
  }

  async getKeyPair(hdPath) {
    const { privkey } = Slip10.derivePath(
      Slip10Curve.Secp256k1,
      this.seed,
      hdPath,
    );
    const { pubkey } = await Secp256k1.makeKeypair(privkey);
    return {
      privkey,
      pubkey: Secp256k1.compressPubkey(pubkey),
    };
  }

  async executeKdf(password, configuration) {
    switch (configuration.algorithm) {
      case "argon2id": {
        const options = configuration.params;
        if (!options || typeof options !== "object") { // Simplified check for JS
          throw new Error("Invalid format of argon2id params");
        }
        return Argon2id.execute(password, cosmjsSalt, options);
      }
      default:
        throw new Error("Unsupported KDF algorithm");
    }
  }

  async serialize(password) {
    const kdfConfiguration = basicPasswordHashingOptions;
    const encryptionKey = await this.executeKdf(password, kdfConfiguration);
    return this.serializeWithEncryptionKey(encryptionKey, kdfConfiguration);
  }

  async serializeWithEncryptionKey(encryptionKey, kdfConfiguration) {
    const dataToEncrypt = {
      mnemonic: this.secret,
      accounts: this.accounts.map(({ hdPath, prefix }) => ({
        hdPath: pathToString(hdPath),
        prefix: prefix,
      })),
    };
    const dataToEncryptRaw = toUtf8(JSON.stringify(dataToEncrypt));
    const encryptionConfiguration = {
      algorithm: supportedAlgorithms.xchacha20poly1305Ietf,
    };
    const encryptedData = await encrypt(
      dataToEncryptRaw,
      encryptionKey,
      encryptionConfiguration,
    );
    const out = {
      type: serializationTypeV1,
      kdf: kdfConfiguration,
      encryption: encryptionConfiguration,
      data: toBase64(encryptedData),
    };
    return JSON.stringify(out);
  }

  async getAccounts() {
    const accountsWithPrivkeys = await this.getAccountsWithPrivkeys();
    return accountsWithPrivkeys.map(({ algo, pubkey, address }) => ({
      algo,
      pubkey,
      address,
    }));
  }

  async getAccountsWithPrivkeys() {
    return Promise.all(
      this.accounts.map(async ({ hdPath, prefix }) => {
        const { privkey, pubkey } = await this.getKeyPair(hdPath);
        const address = toBech32(
          prefix,
          rawSecp256k1PubkeyToRawAddress(pubkey),
        );
        return {
          algo: "secp256k1",
          privkey,
          pubkey,
          address,
        };
      }),
    );
  }

  async signDirect(signerAddress, signDoc) {
    const accounts = await this.getAccountsWithPrivkeys();
    const account = accounts.find(({ address }) => address === signerAddress);
    if (!account) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }
    const { privkey, pubkey } = account;
    const signBytes = makeSignBytes(signDoc);
    const hashedMessage = sha256(signBytes);
    const signature = await Secp256k1.createSignature(hashedMessage, privkey);
    const signatureBytes = new Uint8Array([
      ...signature.r(32),
      ...signature.s(32),
    ]);
    const stdSignature = encodeSecp256k1Signature(pubkey, signatureBytes);
    return {
      signed: signDoc,
      signature: stdSignature,
    };
  }

  async signArb(signerAddress, message) {
    const accounts = await this.getAccountsWithPrivkeys();
    const account = accounts.find(({ address }) => address === signerAddress);
    if (!account) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }
    const { privkey } = account;
    const signDoc = makeADR36AminoSignDoc(signerAddress, message);
    const serializedSignDoc = serializeSignDoc(signDoc);
    const digest = Hash.sha256(serializedSignDoc);
    const cryptoPrivKey = new PrivKeySecp256k1(privkey);
    const signature = cryptoPrivKey.signDigest32(digest);
    return Buffer.from(
      new Uint8Array([...signature.r, ...signature.s]),
    ).toString("base64");
  }
}
