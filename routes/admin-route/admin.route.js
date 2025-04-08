import { Router } from "express";
import { updateClaimStatus } from "../../controller/admin/verifyartist.controller.js";
import { registerAdmin } from "../../controller/admin/admin.controller.js";
import { createEditorialPlaylist, updateEditorialPlaylist } from "../../controller/admin/editorialPlaylist.controller.js";
import { isAdmin } from "../../middlewares/isadmin.middleware.js";

const adminRouter = Router();

// Admin registration
adminRouter.post("/register", registerAdmin);

// Artist verification
adminRouter.patch("/verify/:claimId", isAdmin, updateClaimStatus);

// Editorial playlist management
adminRouter.post("/playlists/editorial", isAdmin, createEditorialPlaylist);
adminRouter.put("/playlists/editorial/:playlistId", isAdmin, updateEditorialPlaylist);

export default adminRouter;
