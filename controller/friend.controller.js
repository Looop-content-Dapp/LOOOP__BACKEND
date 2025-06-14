import { FriendRequest } from "../models/friendRequest.model.js";
import { Friends } from "../models/friends.model.js";
import { User } from "../models/user.model.js";
import { notificationService } from "../services/notification.service.js";
import { WS_EVENTS } from "../utils/websocket/eventTypes.js";
import { websocketService } from "../utils/websocket/websocketServer.js";

export const sendFriendRequest = async (req, res) => {
  try {
    const { receiverId, senderId } = req.body; // Get senderId from request body instead of req.user

    if (!senderId) {
      return res.status(400).json({ message: "Sender ID is required" });
    }

    // Validate if sender exists
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Validate if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Check if users are already friends
    const existingFriendship = await Friends.findOne({
      $or: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId },
      ],
    });

    if (existingFriendship) {
      return res.status(400).json({ message: "Users are already friends" });
    }

    // Check for existing friend request
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });

    if (existingRequest) {
      return res.status(400).json({ message: "Friend request already exists" });
    }

    // Create friend request
    const friendRequest = new FriendRequest({
      senderId,
      receiverId,
    });

    await friendRequest.save();

    // Send notification to receiver
    await notificationService.createNotification({
      userId: receiverId,
      type: "system",
      title: "New Friend Request",
      message: `${sender.username} sent you a friend request`,
      data: {
        requestId: friendRequest._id,
        senderId: senderId,
        senderName: sender.username,
        notificationType: "friend_request",
      },
    });

    // Send real-time notification via WebSocket
    websocketService.sendToUser(receiverId, WS_EVENTS.FRIEND_REQUEST_RECEIVED, {
      requestId: friendRequest._id,
      sender: {
        id: senderId,
        username: sender.username,
      },
    });

    res.status(201).json({ message: "Friend request sent successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error sending friend request", error: error.message });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (friendRequest.receiverId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to accept this request" });
    }

    if (friendRequest.status !== "pending") {
      return res.status(400).json({ message: "Friend request is not pending" });
    }

    // Update friend request status
    friendRequest.status = "accepted";
    await friendRequest.save();

    // Create friendship records for both users
    const friendship1 = new Friends({
      userId: friendRequest.senderId,
      friendId: friendRequest.receiverId,
    });

    const friendship2 = new Friends({
      userId: friendRequest.receiverId,
      friendId: friendRequest.senderId,
    });

    await Promise.all([friendship1.save(), friendship2.save()]);

    // Get sender details for notification
    const sender = await User.findById(friendRequest.senderId);

    // Send notification to sender
    await notificationService.createNotification({
      userId: friendRequest.senderId,
      type: "system",
      title: "Friend Request Accepted",
      message: `${req.user.username} accepted your friend request`,
      data: {
        requestId: friendRequest._id,
        friendId: friendRequest.receiverId,
        friendName: req.user.username,
        notificationType: "friend_request_accepted",
      },
    });

    // Send real-time notification via WebSocket
    websocketService.sendToUser(
      friendRequest.senderId.toString(),
      WS_EVENTS.FRIEND_REQUEST_ACCEPTED,
      {
        requestId: friendRequest._id,
        friend: {
          id: friendRequest.receiverId,
          username: req.user.username,
        },
      }
    );

    res.json({ message: "Friend request accepted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error accepting friend request",
      error: error.message,
    });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (friendRequest.receiverId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to reject this request" });
    }

    if (friendRequest.status !== "pending") {
      return res.status(400).json({ message: "Friend request is not pending" });
    }

    // Update friend request status
    friendRequest.status = "rejected";
    await friendRequest.save();

    // Send notification to sender
    await notificationService.createNotification({
      userId: friendRequest.senderId,
      type: "system",
      title: "Friend Request Rejected",
      message: `${req.user.username} rejected your friend request`,
      data: {
        requestId: friendRequest._id,
      },
    });

    // Send real-time notification via WebSocket
    websocketService.sendToUser(
      friendRequest.senderId.toString(),
      WS_EVENTS.FRIEND_REQUEST_REJECTED,
      {
        requestId: friendRequest._id,
        rejectedBy: {
          id: friendRequest.receiverId,
          username: req.user.username,
        },
      }
    );

    res.json({ message: "Friend request rejected successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error rejecting friend request",
      error: error.message,
    });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get both sent and received requests
    const requests = await FriendRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "username email")
      .populate("receiverId", "username email");

    res.json({
      sent: requests.filter(
        (req) => req.senderId._id.toString() === userId.toString()
      ),
      received: requests.filter(
        (req) => req.receiverId._id.toString() === userId.toString()
      ),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching friend requests",
      error: error.message,
    });
  }
};

export const getFriendList = async (req, res) => {
  try {
    const userId = req.user._id;

    const friends = await Friends.find({ userId }).populate(
      "friendId",
      "username email"
    );

    res.json(friends);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching friend list", error: error.message });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Remove friendship records for both users
    await Friends.deleteMany({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    // Get friend details for notification
    const friend = await User.findById(friendId);

    // Send notification to the removed friend
    await notificationService.createNotification({
      userId: friendId,
      type: "system",
      title: "Friend Removed",
      message: `${req.user.username} removed you from their friends list`,
      data: {
        removedBy: {
          id: userId,
          username: req.user.username,
        },
        notificationType: "friend_removed",
      },
    });

    // Send real-time notification via WebSocket
    websocketService.sendToUser(friendId, WS_EVENTS.FRIEND_REMOVED, {
      removedBy: {
        id: userId,
        username: req.user.username,
      },
    });

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error removing friend", error: error.message });
  }
};
