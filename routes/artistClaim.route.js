import { Router } from "express";
import { submitClaim, getClaimStatus, getUserClaims, updateClaimStatus } from "../controller/artistClaim.controller";

const artistClaimRouter = Router();

artistClaimRouter.post("/submit", submitClaim);
artistClaimRouter.get("/status/:claimId", getClaimStatus);
artistClaimRouter.get("/user/:userId", getUserClaims);
artistClaimRouter.put("/update/:claimId", updateClaimStatus);

export default artistClaimRouter;
