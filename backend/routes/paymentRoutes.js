import express from "express";
import { createRazorpayOrder } from "../controllers/paymentController.js";
import {auth} from "../middleware/authMiddleware.js"

const router = express.Router();
// router.use(auth)

router.post("/create-order", createRazorpayOrder);

export default router;
