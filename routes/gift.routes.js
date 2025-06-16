import express from "express";
import {
  getGiftTransactions,
  sendGift,
} from "../controller/gift.controller.js";

const Giftrouter = express.Router();

// Send a gift to an artist
Giftrouter.post("/send", sendGift);

// Get gift transactions (sent or received)
Giftrouter.get("/transactions", getGiftTransactions);

export default Giftrouter;
