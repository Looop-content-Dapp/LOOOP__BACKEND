import { Router } from "express";
import { getAllFaveArtist, getFaveArtist, getAllFaveArtistForUser, } from "../controller/faveartist.controller";

const faveArtistRouter = Router();

faveArtistRouter.get("/", getAllFaveArtist);
faveArtistRouter.get("/:id", getFaveArtist);
faveArtistRouter.get("/getfaveartistforuser/:userid", getAllFaveArtistForUser);

export default faveArtistRouter;