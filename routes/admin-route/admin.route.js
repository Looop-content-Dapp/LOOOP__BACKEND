import { Router } from "express";
import { updateClaimStatus } from "../../controller/admin/verifyartist.controller.js";

const adminRouter = Router();

adminRouter.patch("/verify/:claimId", updateClaimStatus);

export default adminRouter;
