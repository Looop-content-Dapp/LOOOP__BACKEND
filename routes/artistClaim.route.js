const express = require("express");
const {
  submitClaim,
  getClaimStatus,
  getUserClaims,
  updateClaimStatus
} = require("../controllers/artistClaim.controller");

const artistClaimRouter = express.Router();

artistClaimRouter.post("/submit", submitClaim);
artistClaimRouter.get("/status/:claimId", getClaimStatus);
artistClaimRouter.get("/user/:userId", getUserClaims);
artistClaimRouter.put("/update/:claimId", updateClaimStatus);

module.exports = artistClaimRouter;
