import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDeliveryOrderDetails
} from "../controllers/deliveryPartnerController.js";

import { singleorddetail } from "../controllers/productController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(auth);

// ✅ ORDER ROUTE MUST COME FIRST
router.post("/order", singleorddetail);


// Driver routes
router.post("/create", createDriver);
router.get("/", getDrivers);
router.get("/:id", getDriverById);
router.put("/:id", updateDriver);
router.delete("/:id", deleteDriver);
router.get("/order/:orderId",getDeliveryOrderDetails);

export default router;
