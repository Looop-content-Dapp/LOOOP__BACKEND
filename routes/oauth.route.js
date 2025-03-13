import { Router } from "express";
import { oauth } from "../controller/user.controller.js";

const oauthrouter = Router();

oauthrouter.post("/auth", oauth);

export default oauthrouter;
