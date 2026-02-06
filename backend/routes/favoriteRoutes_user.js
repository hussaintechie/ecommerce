import express from "express";
import {
  getFavorites,
  toggleFavorite,
} from "../controllers/favoriteController_user.js";
import { auth } from "../middleware/authMiddleware.js";
const router = express.Router();
router.use(auth);
router.get("/", getFavorites);
router.post("/toggle", toggleFavorite);

export default router;

