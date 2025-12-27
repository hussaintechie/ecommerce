import express from "express";
import {
  createCoupon,
  getCoupons,
  applyCoupon,
  deletecoupon
} from "../controllers/couponController.js";

import {auth} from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(auth);
/* ADMIN */
router.post("/create",  createCoupon);
router.get("/",getCoupons);
router.delete("/delete/:coupon_id", deletecoupon);

/* CART */
router.get("/apply",  applyCoupon);

export default router;
