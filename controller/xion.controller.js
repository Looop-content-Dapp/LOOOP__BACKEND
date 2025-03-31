import AbstraxionAuth from "../xion/AbstraxionAuth.js";

export const transferFunds = async (req, res) => {
  try {
    const { recipientAddress, amount, denom = "uxion" } = req.body;

    if (!recipientAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: "Recipient address and amount are required"
      });
    }

    const result = await AbstraxionAuth.transferFunds(recipientAddress, amount, denom);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Transfer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getBalance = async (req, res) => {
  try {
    const { address } = req.params;
    const { denoms, starknetAddress } = req.query;

    const denomsArray = denoms ? denoms.split(',') : [
      "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4"
    ];

    const balances = await AbstraxionAuth.getBalances(address, denomsArray, starknetAddress);

    return res.status(200).json({
      success: true,
      data: balances
    });

  } catch (error) {
    console.error("Balance fetch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 10 } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Wallet address is required"
      });
    }

    const transactions = await AbstraxionAuth.getTransactionHistory(address, parseInt(limit));

    if (!transactions) {
      return res.status(404).json({
        success: false,
        message: "No transactions found for this address"
      });
    }

    return res.status(200).json({
      success: true,
      data: transactions
    });

  } catch (error) {
    console.error("Transaction history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction history",
      error: error.message
    });
  }
};

export const getNFTs = async (req, res) => {
  try {
    const { walletAddress, contractAddress } = req.params;

    const nfts = await AbstraxionAuth.getNFTsForAddress(walletAddress, contractAddress);

    return res.status(200).json({
      success: true,
      data: nfts
    });

  } catch (error) {
    console.error("NFT fetch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
