import { Router } from "express";
import { verifyArtist } from "../../controller/admin/verifyartist.controller.js";

const adminRouter = Router();

adminRouter.patch("/verify/:artistId", verifyArtist);

export default adminRouter;
