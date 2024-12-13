import { Router } from "express";
import { deleteGenre, createAGenre, getGenres, getUserGenres, } from "../controller/genre.controller";

const genreRoute = Router();

genreRoute.get("/usergenre/:userId", getUserGenres);
genreRoute.get("/getgenres", getGenres);

genreRoute.post("/creategenre", createAGenre);
genreRoute.delete("/:genreId", deleteGenre);

export default genreRoute;
