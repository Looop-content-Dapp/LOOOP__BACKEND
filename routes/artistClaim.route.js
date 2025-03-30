import { Router } from "express";
import {
  getClaimStatus,
  getUserClaims,
  updateClaimStatus,
  submitArtistClaim,
  getAllClaims,
} from "../controller/artistClaim.controller.js";

const artistClaimRouter = Router();

artistClaimRouter.post("/submit", submitArtistClaim);
artistClaimRouter.get("/status/:claimId", getClaimStatus);
artistClaimRouter.get("/user/:userId", getUserClaims);
artistClaimRouter.put("/update/:claimId", updateClaimStatus);
artistClaimRouter.get("/all", getAllClaims);

export default artistClaimRouter;
