import axios from "axios";

const XionWalletService = {
  createAccount: async (email, password) => {
    const response = await axios.post(
      `${process.env.WALLET_API_BASE_URL}/signup`,
      {
        email,
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to create account");
    }

    if (response.status === 200) {
      return response.data.data;
    }
  },

  loginAccount: async (email, password) => {
    const response = await axios.post(
      `${process.env.WALLET_API_BASE_URL}/login`,
      {
        email,
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to login account");
    }

    if (response.status === 200) {
      return response.data.data;
    }
  },

  executeTransaction: async (email, contractAddress, msg, memo) => {
    const response = await axios.post(
      `${process.env.WALLET_API_BASE_URL}/execute-contract`,
      {
        email,
        contractAddress,
        msg,
        memo,
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to execute transaction");
    }

    if (response.status === 200) {
      return response.data.data;
    }
  },

  getWalletBalance: async (address) => {
    const response = await axios.get(
      `${process.env.WALLET_API_BASE_URL}/balance/${address}`
    );
    if (response.status !== 200) {
      throw new Error("Failed to get wallet balance");
    }

    if (response.status === 200) {
      return response.data.data;
    }
  },
};

export default XionWalletService;
