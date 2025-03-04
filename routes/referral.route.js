import { Router } from "express";
import { getUserReferral } from "../controller/referral.controller.js";

const referralRouter = Router();

referralRouter.get("/:id", getUserReferral);

export default referralRouter;
