import { Router } from "express";
import {
  getAllPreferences,
  getPreference,
  getUserPeferences,
} from "../controller/peferences.controller";

const preferenceRouter = Router();

preferenceRouter.get("/", getAllPreferences);
preferenceRouter.get("/:id", getPreference);
preferenceRouter.get("/user/:id", getUserPeferences);

export default preferenceRouter;
