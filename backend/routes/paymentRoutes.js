import express from "express";
import { createRazorpayOrder,verifyRazorpayPayment } from "../controllers/paymentController.js";
import {auth} from "../middleware/authMiddleware.js"

const router = express.Router();
// router.use(auth)
router.use(auth)
router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyRazorpayPayment);
export default router;
