import express from "express";
import { getUserNFTDetails } from "../controller/nft.controller.js";

const router = express.Router();

router.get("/user/:userId", getUserNFTDetails);

export default router;
