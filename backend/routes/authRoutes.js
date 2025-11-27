import express from "express";
import {
  adminRegister,
  sendOTP,
  verifyOTP,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/admin/register", adminRegister);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

export default router;
