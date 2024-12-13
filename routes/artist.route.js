import { Router } from "express";
import {
  getAllArtists, getArtist, createArtist, getArtistSubcribers, followArtist, getFollow, getArtistPost,
} from "../controller/artist.controller.js";

// import { getArtistBasedOnUserGenreExcludingWhoTheyFollow } from "../controller/song.controller";
const artistRouter = Router();

artistRouter.get("/", getAllArtists);
artistRouter.get("/:id", getArtist);
artistRouter.get("/getartistsubcribers/:artistId", getArtistSubcribers);
artistRouter.get("/follow/:id", getFollow);
// artistRouter.get(
//   "/usergenres/:userId",
//   getArtistBasedOnUserGenreExcludingWhoTheyFollow
// );
artistRouter.get("/artistpost/:artistId", getArtistPost);

artistRouter.post("/follow/:userId/:artistId", followArtist);
artistRouter.post("/createartist", createArtist);

// router.delete("/:id", deleteUsergetAllUsers);

export default artistRouter;
