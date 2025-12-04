import express from "express";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  toggleFavorite
} from "../controllers/favoriteController.js";

const router = express.Router();

router.post("/add", addFavorite);
router.delete("/remove", removeFavorite);
router.get("/user/:user_id", getFavorites);
router.post("/toggle", toggleFavorite);

export default router;
