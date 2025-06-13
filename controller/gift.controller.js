import { Artist } from "../models/artist.model.js";
import Transaction from "../models/Transaction.model.js";
import { User } from "../models/user.model.js";
import NotificationService from "../services/notification.service.js";
import StarknetService from "../services/starknet.service.js";
import { WS_EVENTS } from "../utils/websocket/eventTypes.js";
import { websocketService } from "../utils/websocket/websocketServer.js";

const starknetService = new StarknetService();
const notificationService = new NotificationService();

/**
 * Send a USDC gift to an artist
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const sendGift = async (req, res) => {
  const { artistId, amount, message } = req.body;
  const userId = req.user.id;

  try {
    // Validate artist exists and is verified
    const artist = await Artist.findOne({ artistId, verified: true });
    if (!artist) {
      return res.status(404).json({ error: "Artist not found or not verified" });
    }

    // Get artist's community
    const community = await Community.findOne({ 
      createdBy: artist._id,
      status: "active"
    });
    if (!community) {
      return res.status(404).json({ error: "Artist's community not found or not active" });
    }

    // Get user's wallet info
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check user's USDC balance
    const userBalance = await starknetService.getStarkNetUSDCBalance(user.email);
    if (userBalance < amount) {
      return res.status(400).json({ error: "Insufficient USDC balance" });
    }

    // Create pending transaction record
    const transaction = new Transaction({
      userId: user.id,
      recipientId: artist.artistId, // Keep artistId as recipient
      amount,
      currency: "USDC",
      paymentMethod: "wallet",
      type: "gift",
      blockchain: "Starknet",
      title: `Gift to ${artist.name}`,
      message,
      metadata: {
        artistName: artist.name,
        communityName: community.communityName,
        contractAddress: community.tribePass.contractAddress
      },
    });
    await transaction.save();

    // Execute USDC transfer to community contract
    const result = await starknetService.executeUSDCTransfer(
      user.email,
      community.tribePass.contractAddress, // Send to community contract
      amount
    );

    // Update transaction with result
    transaction.transactionHash = result.transactionHash;
    transaction.status = result.status === "ACCEPTED_ON_L2" ? "success" : "failed";
    await transaction.save();

    // Send notification to artist
    if (transaction.status === "success") {
      await notificationService.sendNotification({
        userId: artist.userId,
        type: "gift_received",
        title: "New Gift Received!",
        message: `You received a gift of ${amount} USDC in your community ${community.communityName} from ${user.username}`,
        data: {
          amount,
          currency: "USDC",
          senderName: user.username,
          communityName: community.communityName,
          transactionId: transaction._id,
        },
      });
    }

    // Notify the artist about the gift via WebSocket
    websocketService.notifyUser(artist.userId.toString(), {
      type: WS_EVENTS.GIFT_RECEIVED,
      data: {
        from: user.fullname || user.email,
        amount: amount / 1e6,
        currency: "USDC",
        communityName: community.communityName,
        transactionHash: result.transactionHash,
      },
    });

    return res.json({
      success: true,
      transaction: {
        id: transaction._id,
        status: transaction.status,
        amount,
        transactionHash: transaction.transactionHash,
      },
    });
  } catch (error) {
    console.error("Error sending gift:", error);
    return res.status(500).json({ error: "Failed to send gift" });
  }
};

/**
 * Get gift transactions for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getGiftTransactions = async (req, res) => {
  const userId = req.user.id;
  const { type = "sent" } = req.query;

  try {
    const query =
      type === "sent"
        ? { userId, type: "gift" }
        : { recipientId: userId, type: "gift" };

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ transactions });
  } catch (error) {
    console.error("Error fetching gift transactions:", error);
    return res.status(500).json({ error: "Failed to fetch gift transactions" });
  }
};

export default {
  sendGift,
  getGiftTransactions,
};
