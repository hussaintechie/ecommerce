import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDeliveryOrderDetails,
  deliveryPartnerLogin,
  getLoggedInDriver,
  sendDeliveryOTP,
  verifyDeliveryOTP
} from "../controllers/deliveryPartnerController.js";

import { singleorddetail } from "../controllers/orderController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", deliveryPartnerLogin);
router.use(auth);

// 🔹 ORDER / ACTION ROUTES FIRST
router.post("/order", singleorddetail);
router.get("/order/:orderId", getDeliveryOrderDetails);
router.post(
  "/send-delivery-otp",sendDeliveryOTP
);
router.post(
  "/verify-delivery-otp",verifyDeliveryOTP
);

router.get("/me", getLoggedInDriver);

// 🔹 DRIVER CRUD ROUTES LAST
router.post("/create", createDriver);
router.get("/", getDrivers);
router.put("/:id", updateDriver);
router.delete("/:id", deleteDriver);
router.get("/:id", getDriverById);   // ✅ ALWAYS LAST

export default router;



