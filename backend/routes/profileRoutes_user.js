import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController_user.js";

const router = express.Router();

router.use(auth);

router.get("/", getProfile);
router.put("/update", updateProfile);

export default router;
