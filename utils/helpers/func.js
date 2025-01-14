import {
  Account,
  constants,
  ec,
  json,
  stark,
  RpcProvider,
  hash,
  CallData,
  Account,
  RpcProvider,
} from "starknet";

export const createWallet = () => {
  try {
    const provider = new RpcProvider({ nodeUrl: `${"myNodeUrl"}` });

    const privateKey = stark.randomAddress();
    console.log("New OZ account:\nprivateKey=", privateKey);

    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
    console.log("publicKey=", starkKeyPub);
  } catch (error) {
    console.error(error);
  }
};

export const connectToExistingContract = () => {
  try {
    // initialize provider
    const provider = new RpcProvider({
      nodeUrl:
        "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/fSzC1H313SjuY9C8lIKb3VGugN_tH6bt",
    });
    // initialize existing pre-deployed account 0 of Devnet
    const privateKey = "";
    const accountAddress =
      "0x029f6ce2729927e73725cf1c207b12e9171284abb3e7e5945460c6a9a05b998f";

    const account = new Account(provider, accountAddress, privateKey);
  } catch (error) {
    console.log(error);
  }
};


// module.exports = { createWallet, connectToExistingContract };
