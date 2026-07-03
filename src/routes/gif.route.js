import { Router } from "express";
import { searchGifs } from "../controllers/gif.controller.js";

const gifRouter = Router();

// GET /api/gifs?q=cat — search Tenor GIFs (proxied; key stays on the server)
gifRouter.get("/gifs", searchGifs);

export default gifRouter;
