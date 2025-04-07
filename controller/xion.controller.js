import AbstraxionAuth from "../xion/AbstraxionAuth.js";
import Transaction from '../models/Transaction.model.js';

export const transferFunds = async (req, res) => {
  try {
    const { recipientAddress, amount, denom = "uxion" } = req.body;

    if (!recipientAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: "Recipient address and amount are required",
      });
    }

    const abstraxionAuth = new AbstraxionAuth();
    const result = await abstraxionAuth.transferFunds(
      recipientAddress,
      amount,
      denom
    );

    // Create transaction record
    await Transaction.create({
      transactionHash: result.transactionHash,
      sender: result.sender,
      recipient: result.recipient,
      amount: result.amount,
      denom: result.denom,
      type: 'transfer',
      status: 'completed',
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Transfer error:", error);

    // Record failed transaction if we have sender information
    if (error.sender) {
      await Transaction.create({
        sender: error.sender,
        recipient: error.recipient,
        amount: error.amount,
        denom: error.denom,
        type: 'transfer',
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBalance = async (req, res) => {
  try {
    const { address } = req.params;
    const { denoms, starknetAddress } = req.query;

    const denomsArray = denoms
      ? denoms.split(",")
      : [
          "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",
        ];

    const balances = await AbstraxionAuth.getBalances(
      address,
      denomsArray,
      starknetAddress
    );

    return res.status(200).json({
      success: true,
      data: balances,
    });
  } catch (error) {
    console.error("Balance fetch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
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
        message: "Wallet address is required",
      });
    }

    const transactions = await AbstraxionAuth.getTransactionHistory(
      address,
      parseInt(limit)
    );

    if (!transactions) {
      return res.status(404).json({
        success: false,
        message: "No transactions found for this address",
      });
    }

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Transaction history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction history",
      error: error.message,
    });
  }
};

export const getNFTs = async (req, res) => {
  try {
    const { walletAddress, contractAddress } = req.params;

    const nfts = await AbstraxionAuth.getNFTsForAddress(
      walletAddress,
      contractAddress
    );

    return res.status(200).json({
      success: true,
      data: nfts,
    });
  } catch (error) {
    console.error("NFT fetch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
