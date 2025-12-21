import express from "express";
import { getCustomers, getUserOrders } from "../controllers/userController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/customers", auth, getCustomers);
router.post("/getuserorders", auth, getUserOrders);

export default router;
