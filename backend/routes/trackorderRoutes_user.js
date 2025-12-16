// routes/trackOrderRoutes.js

import express from "express";
import {
  trackOrder,
  verifyDeliveryOTP,
  generateDeliveryOTP,
  markOutForDelivery,
} from "../controllers/trackorderconyoller_user.js";

import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ APPLY AUTH ONCE
router.use(auth);

// ✅ ROUTES
router.post("/trackOrder", trackOrder);
router.post("/generateDeliveryOTP", generateDeliveryOTP);
router.post("/verifyDeliveryOTP", verifyDeliveryOTP);
router.post("/markOutForDelivery", markOutForDelivery);

export default router;
