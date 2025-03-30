import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { customAccountFromAny } from "@burnt-labs/signers";
import { fromBech32 } from "@cosmjs/encoding";

  function isValidBech32(address) {
    try {
      fromBech32(address);
      return true;
    } catch {
      return false;
    }
  }

  export class GranteeSignerClient extends SigningStargateClient {
    constructor(cometClient, signer, options) {
      const { granterAddress, granteeAddress, gasPrice, treasuryAddress, ...restOptions } = options;
      super(cometClient, signer, { ...restOptions, gasPrice });

      this.granterAddress = granterAddress;
      if (!granteeAddress) {
        throw new Error("granteeAddress is required");
      }
      this._granteeAddress = granteeAddress;
      this._gasPrice = gasPrice;
      this._treasury = treasuryAddress;
      this._signer = signer;
      this._defaultGasMultiplier = 1.4;
    }

    get granteeAddress() {
      return this._granteeAddress;
    }

    async getGranteeAccountData() {
      const accounts = await this._signer.getAccounts();
      for (const account of accounts) {
        if (account.address === this._granteeAddress) {
          return account;
        }
      }
      return undefined;
    }

    static async connectWithSigner(endpoint, signer, options, retryCount = 0, maxRetries = 3) {
      try {
        console.log(`Attempting to connect to RPC: ${typeof endpoint === 'string' ? endpoint : endpoint.url}, retry: ${retryCount}`);
        const tmClient = await Tendermint37Client.connect(endpoint);
        return GranteeSignerClient.createWithSigner(tmClient, signer, options);
      } catch (error) {
        console.error(`Failed to connect to RPC: ${error.message}`);
        if (retryCount < maxRetries) {
          console.log(`Retrying connection, attempt ${retryCount + 1} of ${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return GranteeSignerClient.connectWithSigner(endpoint, signer, options, retryCount + 1, maxRetries);
        }
        throw new Error(`Failed to connect to RPC after ${maxRetries} retries: ${error.message}`);
      }
    }

    static async createWithSigner(cometClient, signer, options) {
      return new GranteeSignerClient(cometClient, signer, options);
    }

    async getAccount(searchAddress) {
      const account = await this.forceGetQueryClient().auth.account(searchAddress);
      if (!account) {
        return null;
      }
      return customAccountFromAny(account);
    }

    async signAndBroadcast(signerAddress, messages, fee, memo = "", timeoutHeight, retryCount = 0, maxRetries = 3) {
      let usedFee;
      const granter = this._treasury || this.granterAddress;

      if (this.granterAddress && signerAddress === this.granterAddress) {
        signerAddress = this.granteeAddress;
        messages = [{
          typeUrl: "/cosmos.authz.v1beta1.MsgExec",
          value: MsgExec.fromPartial({
            grantee: this.granteeAddress,
            msgs: messages.map(msg => this.registry.encodeAsAny(msg)),
          }),
        }];
      }

      const account = await this.getAccount(signerAddress);
      let sequence = account ? account.sequence : 0;
      const accountNumber = account ? account.accountNumber : 0;

      sequence += retryCount;

      console.log(`Broadcasting tx with signer: ${signerAddress}, sequence: ${sequence}, retry: ${retryCount}`);

      if (fee === "auto" || typeof fee === "number") {
        if (!this._gasPrice) {
          throw new Error("Gas price must be set when auto gas is used");
        }
        const gasEstimation = await this.simulate(signerAddress, messages, memo);
        const multiplier = typeof fee === "number" ? fee : this._defaultGasMultiplier;
        const calculatedFee = calculateFee(Math.round(gasEstimation * multiplier), this._gasPrice);

        usedFee = (this.granterAddress && isValidBech32(this.granterAddress) && granter)
          ? { ...calculatedFee, granter: this.granterAddress }
          : calculatedFee;
      } else {
        usedFee = (this.granterAddress && isValidBech32(this.granterAddress) && granter)
          ? { ...fee, granter: this.granterAddress }
          : fee;
      }

      const txRaw = await this.sign(
        signerAddress,
        messages,
        usedFee,
        memo,
        { accountNumber, sequence, chainId: await this.getChainId() },
      );
      const txBytes = TxRaw.encode(txRaw).finish();
      console.log(`Tx bytes: ${Buffer.from(txBytes).toString('hex')}`);

      try {
        const response = await this.broadcastTx(
          txBytes,
          this.broadcastTimeoutMs,
          this.broadcastPollIntervalMs,
        );
        return response;
      } catch (error) {
        if (
          error.message.includes("tx already exists in cache") &&
          retryCount < maxRetries
        ) {
          console.warn(`Tx exists in cache; retrying with sequence ${sequence + 1}`);
          return this.signAndBroadcast(
            signerAddress,
            messages,
            fee,
            memo,
            timeoutHeight,
            retryCount + 1,
            maxRetries,
          );
        }
        throw error;
      }
    }

    async sign(signerAddress, messages, fee, memo, explicitSignerData) {
      if (this.grantExpiration && this.grantExpiration < new Date()) {
        throw new Error("Grant expired. Please re-authenticate.");
      }

      if (this.granterAddress && signerAddress === this.granterAddress) {
        signerAddress = this.granteeAddress;
        messages = [{
          typeUrl: "/cosmos.authz.v1beta1.MsgExec",
          value: MsgExec.fromPartial({
            grantee: signerAddress,
            msgs: messages.map(msg => this.registry.encodeAsAny(msg)),
          }),
        }];
      }

      return super.sign(signerAddress, messages, fee, memo, explicitSignerData);
    }
  }
