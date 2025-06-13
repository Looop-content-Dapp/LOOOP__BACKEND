import express from "express";
import {
  getGiftTransactions,
  sendGift,
} from "../controller/gift.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
// import { validateGiftRequest } from "../validations_schemas/gift.validation.js";

const router = express.Router();

// Protected routes - require authentication
router.use(authMiddleware);

// Send a gift to an artist
router.post("/send", sendGift);

// Get gift transactions (sent or received)
router.get("/transactions", getGiftTransactions);

export default router;
