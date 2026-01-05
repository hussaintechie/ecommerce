import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import {auth} from "../middleware/authMiddleware.js";
const router = express.Router();
router.use(auth);
router.get("/dashboard", getDashboardStats);

export default router;
