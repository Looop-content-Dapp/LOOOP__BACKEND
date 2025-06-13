import express from "express";
import {
  acceptFriendRequest,
  getFriendList,
  getFriendRequests,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "../controller/friend.controller.js";

const router = express.Router();

// Friend request routes
router.post("/request", sendFriendRequest);
router.post("/request/:requestId/accept", acceptFriendRequest);
router.post("/request/:requestId/reject", rejectFriendRequest);
router.get("/requests", getFriendRequests);

// Friend management routes
router.get("/list", getFriendList);
router.delete("/:friendId", removeFriend);

export default router;
