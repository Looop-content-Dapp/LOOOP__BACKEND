import axios from "axios";

const XionWalletService = {
  createAccount: async (email, password) => {
    const response = await axios.post(
      `${process.env.WALLET_API_BASE_URL}/signup`,
      {
        email,
        password,
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
        password,
      }
    );
    if (response.status !== 200) {
      throw new Error("Failed to login account");
    }

    if (response.status === 200) {
      return response.data.data;
    }
  },

  executeTransaction: async (email, password, contractAddress, msg, memo) => {
    const response = await axios.post(
      `${process.env.WALLET_API_BASE_URL}/execute-transaction`,
      {
        email,
        password,
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
};

export default XionWalletService;
