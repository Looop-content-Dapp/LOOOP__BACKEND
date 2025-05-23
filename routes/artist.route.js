import { Router } from "express";
import {
  getAllArtists,
  getArtist,
  createArtist,
  getArtistSubcribers,
  getArtistPost,
  verifyArtistEmail,
  signContract,
  getArtistMusicDetails
} from "../controller/artist.controller.js";

const artistRouter = Router();

artistRouter.get("/", getAllArtists);
artistRouter.get("/:id", getArtist);
artistRouter.get("/getartistsubcribers/:artistId", getArtistSubcribers);
artistRouter.get("/artistpost/:artistId", getArtistPost);
artistRouter.patch("/verify-artist-email", verifyArtistEmail);
artistRouter.post("/createartist", createArtist);
artistRouter.post("/sign-contract", signContract);
artistRouter.get("/music/:artistId", getArtistMusicDetails);

export default artistRouter;
